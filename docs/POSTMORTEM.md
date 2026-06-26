# Post-Mortem — Inmovel CRM build & deploy

**EVENT:** Inmovel CRM — build & deploy (full session, 2026-06-12/13)
**EXPECTED:** 16 tickets built and deployed smoothly via the agent pipeline.
**ACTUAL:** Product 100% built and IN PRODUCTION with real data (1,476 leads), but via a very different route than planned.
**IMPACT:** ~50% of session time went to infrastructure/deploy, not to building the CRM.

## Timeline
- Start: setup-interview + plan (16 tickets, 6 waves) — clean.
- Wave 1 dispatch: 10-agent team launched → worktrees start **disappearing while devs are working**.
- 4 macOS hook-portability bugs (`/tmp` vs `/private/tmp` path comparisons, missing `timeout` binary) → fixed one by one.
- Pivot decision: abandon the agent team → **direct mode** (orchestrator builds/merges).
- 42 merge conflicts hand-resolved (Waves 1–2 touched the same files).
- Waves 3–6 built directly, no friction.
- Deploy: 7+ bugs that typecheck could NOT see (forward-ref FK, dead companies branch, asesor names vs ids, strict enum checks, conversaciones FK, configuration 406, "null null").

## 5 Whys
1. Why did ~half the time go to non-build work? → Because the agent infra failed repeatedly.
2. Why did the infra fail? → Hooks deleted active worktrees and tests wouldn't run.
3. Why? → They compared raw `/tmp` paths against git's canonical `/private/tmp`, and called `timeout` (absent on macOS).
4. Why did they have that? → The hooks harness was **ported from Linux** without macOS adaptation.
5. Why wasn't it caught earlier? → This harness had **never actually run on macOS**; typecheck/CI exercises neither the hooks nor a real deploy.

**ROOT CAUSE:** The harness (agent hooks + schema flow) assumed Linux/CI and was never executed against the real environment (macOS + live Supabase/Railway); its defects were only observable when actually run.

## Contributing factors
- **Typecheck-green ≠ correct** — the 7 deploy bugs (FKs, enums, 406) passed the compiler and only surfaced against a real DB.
- **Dirty real data** — the Sheet had duplicate `sheet_id`s, advisor names instead of ids, missing dates; no fixture anticipated it.
- **The agent team amplified cost** — 3 devs + 6 reviewers + merger multiplied messages during the infra debugging.

## Warning signs missed
- First "worktree not found" report (13:28) was treated as a one-off glitch instead of a systemic bug; it recurred 3× before the root fix.
- "Reboot the Mac" — assumed a reboot was needed without verifying; it was diagnostic laziness (the app actually ran).

## In control vs out of control
**In control:** pivot to direct mode (right call, ~5× cheaper); fix bugs at the source (hooks + schemas), not local patches; deploy for real to catch the invisible bugs.
**Out of control:** Sheet data quality (bot-origin); the harness being a Linux port.

## Change register
| Action | Owner | Due | Verification |
|---|---|---|---|
| Validate the deployed app (not just typecheck) before declaring "done" | you/me | every deploy | URL returns 200 + renders with data |
| Admin "reassign advisor" control in the CRM | backlog | next session | lead-show selector writes `asesor_asignado` |
| Use the CRM with real traffic | you | these days | the S6 frontier holds across syncs |

**VERIFICATION DATE:** when you return after testing for a few days.

## One-line lesson
**Deploying for real is what made the product good.** The worst bugs — the ones that would have broken the CRM with real users — were 100% invisible to typecheck and only appeared when creating the Supabase project, applying the schema, and loading the real 1,476 leads. Insisting on doing it end-to-end is why it actually works, not just "green in theory."

---

# Post-Mortem — Inmovel CRM live-ops: data-quality fires & features

**EVENT:** Operating the live CRM (2026-06-24/25) — a string of data-quality briefs plus small features.
**EXPECTED:** A few quick fixes on a running CRM.
**ACTUAL:** Resolved 4 data-quality fires and shipped 4 features — and found they were all the SAME root cause. Also produced a Sheet→Supabase migration strategy.
**IMPACT:** CRM is now trustworthy for advisors (assignments persist, advisor names correct, reactivation replies visible on the ficha); the structural debt is now named with a phased plan.

## Timeline
- **Brief 1 — data quality:** `asesor_nombre` held lead chat text (108 rows), `telefono` NULL (62), `stage` NULL (0 — already fixed by an earlier derive trigger). Hardened `syncLeads` (phone from `sheet_id`; advisor name only from canonical sales, never raw Sheet).
- **Brief 2 — reassignments revert:** the sync reassigned `sales_id` from the Sheet every ~2 min for ≤S5 leads, reverting CRM reassignments (Diana flipped Ana→Josafat). Fixed: assignment is CRM-owned once set (sync only assigns first-time).
- **Strategic question** "¿migrar el Sheet a Supabase?" → wrote `docs/SHEET-TO-SUPABASE-MIGRATION.md`.
- **Brief 3 — reactivation replies as notes:** `reactivaciones` table + `conversaciones` AFTER INSERT trigger surface replies as `[Reactivación]` notes on the ficha.
- **Features:** rename S7 "Visita agendada"→"Visita solicitada"; kanban card shows the advisor (👤) in place of the useless phone.
- **Deploy scare:** a "failed!" deploy was a Railway transient registry-auth error (`oauth token: denied`), not our code; a separate "still shows the phone" was the PWA service worker serving a stale bundle. Site returned 200 throughout.
- **"Pending Pending" advisor:** Luis Antonio's `sales` row was created with the default name and never set; fixed name + refreshed his 18 leads' `asesor_nombre`.

## 5 Whys (the through-line)
1. Why so many independent data fires? → The Sheet and the CRM both own the same fields.
2. Why both? → The bot's data layer is the Sheet; a one-way sync mirrors it; the CRM also edits the same rows.
3. Why does that corrupt/revert? → The Sheet is schema-less/untyped and is treated as source of truth for ≤S5; CRM edits lose on the next sync.
4. Why is the Sheet the writer? → Historical — the bot predates Supabase.
5. Why not migrated? → No deliberate plan; ownership was drifting into the CRM field-by-field, reactively.

**ROOT CAUSE:** Dual source of truth (Sheet vs Supabase). Every fix is the CRM defending itself against the Sheet — band-aids, not a cure.

## Contributing factors
- **Hardcoded `REACTIVACION_TELS`** in the bot (`index.js`) — doesn't scale; my note trigger had to copy the list into a table.
- **Advisor `sales` rows default to name 'Pending'** and aren't set on activation.
- **Self-inflicted:** a JS template literal `'\s+'` ate the backslash → mangled 203 advisor names ("jo afat olguin"); caught and fixed within the same step. Use `String.raw` / double-escape in DB regex strings.

## Warning signs / handled well
- A FAILED deploy badge ≠ outage. Always check `curl` HTTP + which deploy is ACTIVE before assuming "down" — the site was healthy the whole time.
- Every fix was verified against reality, not assumed: forced a real sync cycle to prove Diana stuck; simulated a `conversaciones` insert to prove the note trigger (and idempotency); inspected the live JS bundle to prove the phone was gone server-side.

## In control vs out of control
**In control:** defensive sync hardening; decoupling assignment from the stage frontier; writing the migration plan instead of patching silently; end-to-end verification of each change.
**Out of control:** Sheet/bot-origin data; Railway's transient registry hiccup; the bot-side hardcoded list (the durable fix lives in `~/inmovel`).

## Change register
| Action | Owner | Due | Verification |
|---|---|---|---|
| Bot reads reactivated phones from `public.reactivaciones` (one source, no deploy to add) | inmovel side | next bot change | adding a phone = an insert, guard still fires |
| Start Sheet→Supabase migration (dual-write first) per the strategy doc | backlog | when scheduled | bot writes Supabase; sync becomes a safety net |
| Set advisor real name + whatsapp at activation (not default 'Pending') | process | every new advisor | advisor shows by name in the CRM immediately |
| Provide the Compra-base reactivation template name | you | when handy | `reactivaciones.template` updated for 89 rows |
| Re-apply the other ~6 lost reassignments from 24-jun | you/me | when you have the list | they persist across a sync cycle |

## One-line lesson
**Every fire this session was the same fire** — the Sheet and the CRM both claiming to own the data. Patching each field restores calm for a day; the only real fix is one source of truth, which is why the migration doc — not any single patch — is the actual deliverable.

---

# Post-Mortem — Inmovel CRM live-ops round 2: UI/mobile + Baileys surfacing

**EVENT:** Second live-ops stretch (2026-06-25) — UI features, mobile pipeline, and connecting the ficha to the Baileys advisor conversation.
**EXPECTED:** A few small UI tweaks.
**ACTUAL:** Shipped 5 features, fixed a mobile 404, parked a 20-lead Sheet corruption correctly, and wired the advisor↔lead conversation into the ficha. One deploy "outage" scare that wasn't one.
**IMPACT:** Advisors get a usable mobile pipeline and see the real advisor↔lead WhatsApp conversation on the ficha.

## Timeline
- **Stage rename** S7 "Visita agendada"→"Visita solicitada" — needed editing BOTH `defaultConfiguration.ts` AND the live `public.configuration` row (DB wins at runtime).
- **Kanban card**: advisor badge (👤) replaces the useless phone.
- **Deploy "failed!" scare**: a FAILED deploy was a Railway transient registry-auth error (`oauth token: denied` pulling nixpacks), retryable; separately, "still shows the phone" was the PWA service worker serving a stale bundle. Site returned 200 throughout — never down.
- **Mobile kanban 404**: `/leads/kanban` was registered only in DesktopAdmin → mobile got "No encontrado". Registered it (and `/l/:id`) in MobileAdmin.
- **"Pending Pending" advisor**: Luis Antonio's `sales` row was created with the default name and never set; fixed name + refreshed his 18 leads.
- **`asesor_asignado` Sheet corruption** (visit phrases overwrote the advisor for ~20 visit-intent leads): parked them on Josafat (persists now), Selene's 15 left alone, descriptive brief handed to the inmovel builder.
- **Mobile stages UX**: chips+list pipeline view + per-lead stage picker (S6+ only).
- **Baileys surfacing**: the ficha now shows the real advisor↔lead conversation via a curated `public.advisor_conversation` view.

## 5 Whys (this round's theme: duplication WITHIN the CRM)
1. Why did the S7 rename, the mobile 404, and the "Pending" name each need an extra, easy-to-miss step? → The same fact lived in two places.
2. Which places? → code default vs DB `configuration` row; DesktopAdmin routes vs MobileAdmin routes; `auth.users` vs the `sales` display name.
3. Why two places? → The app has parallel surfaces (desktop/mobile admin, code config vs DB config, multiple schemas) kept in sync by hand.
4. Why by hand? → No single source per concern; each surface was added independently.

**ROOT CAUSE:** Duplicated sources of truth — this round *inside* the CRM (code vs DB config, desktop vs mobile routes), the same disease as the Sheet-vs-Supabase macro problem, one scale down.

## Contributing factors
- **PWA cache + Railway transient** make "did it ship?" / "is it down?" ambiguous → burned a cycle on a non-outage.
- **Cross-schema immaturity**: the Baileys `wa_listener` data is young and inconsistent (number `52`/`521`, jid `@lid`/`@s.whatsapp.net`); only ~29 messages link cleanly today.

## Warning signs / handled well
- "failed!" → checked `curl` HTTP 200 + which deploy was ACTIVE before concluding outage. **A FAILED deploy badge ≠ a down site.**
- Verified every fix: typecheck before each deploy, monitored deploys to SUCCESS, inspected the live JS bundle to prove the phone was gone server-side, simulated/queried data for the trigger and the conversation join.
- For the immature Baileys data, chose a **curated `public` view** that absorbs the messy join in one place — so the UI never changes as the listener matures.

## In control vs out of control
**In control:** registering mobile routes, dual-writing config (code + DB), the curated definer view for cross-schema access, single deploy + monitor, honest "it's sparse now, grows later".
**Out of control:** Railway registry hiccup; PWA cache TTL; Baileys listener data maturity (inmovel side).

## Change register
| Action | Owner | Due | Verification |
|---|---|---|---|
| Stage label / config change → update BOTH `defaultConfiguration.ts` AND the DB `configuration` row | process | every config change | new label shows after reload |
| New route → register in BOTH DesktopAdmin and MobileAdmin | process | every new route | no 404 on mobile |
| New advisor → set `sales` name + `whatsapp` (not default 'Pending') | process | every activation | advisor shows by name immediately |
| Baileys "suggestions" accept-cards on the ficha | backlog | when `wa_listener.suggestions` produces rows | suggested stage/note appliable from the lead |

## One-line lesson
**The tax this round was duplication *inside* the CRM** — code vs DB config, desktop vs mobile, two schemas. Fixes mean touching every surface, and a "deploy FAILED" almost never means "site down" — check the HTTP and the ACTIVE deploy first.
