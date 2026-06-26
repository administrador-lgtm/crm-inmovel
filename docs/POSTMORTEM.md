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

---

# Post-Mortem — Baileys 2nd-advisor rollout: design validated (checkpoint)

**EVENT:** A second advisor work number (Josafat's) was added to the Baileys listener (2026-06-26). Verified whether the CRM picks it up with no code change.
**EXPECTED:** The `advisor_conversation` view + panel light up for the new advisor automatically (the "scales by design" bet from round 2).
**ACTUAL:** It did. `wa_listener.chats` now has `number=5215516569427 → advisor_sales_id=1`, the device is actively writing (32 msgs, last one minutes old), and the view links his conversations — zero code/deploy needed. This is a verification checkpoint, not an incident.

## What was confirmed
- **Auto-scale held.** No CRM change was required for the 2nd advisor — the curated view + RLS-by-`can_access_lead` design absorbed the new device. As more advisors onboard Baileys, they light up the same way.
- **The "immaturity absorbed by the view" bet paid off, concretely.** The listener recorded Josafat's *same* device under two number formats — `5215516569427` (32 msgs) and `525516569427` (29 msgs, missing the `1`). The view's last-10-digit normalization (`right(digits,10)='5516569427'`) merged both; nothing lost. Had the join used the raw number, half his messages would have been dropped silently.
- **The CRM's number for Josafat** (`sales`: tel `5516569427`, wa `5215516569427`) matches the listener device — which is *why* it links. Advisor whatsapp ↔ listener device number is the implicit contract.

## 5 Whys (short — no failure, a design check)
1. Why did the 2nd advisor work with no change? → The view joins any chat with a `contact_id` and gates by lead access, not by a hardcoded advisor.
2. Why did both number formats link? → The join normalizes to the last 10 digits, anticipating the listener's `52`/`521` inconsistency.
3. Why was that normalization already there? → Round 2 chose to absorb listener immaturity inside the view on purpose.

**TAKEAWAY:** The round-2 architectural bets (scale-by-design + curated view absorbs messy cross-schema data) were validated by the first real rollout step.

## Change register
| Action | Owner | Due | Verification |
|---|---|---|---|
| Keep advisor `sales.whatsapp` in sync with their Baileys device number | process | every advisor onboard | their conversations link on the ficha |
| Watch link rate as more advisors onboard; if the last-10 normalization ever collides, revisit the join | me | ongoing | linked-message count tracks captured count |

## One-line lesson
**The design held its first real test:** adding a second advisor to the listener needed zero CRM work, and the deliberate last-10-digit normalization quietly saved half the new advisor's messages from a format mismatch — proof that absorbing upstream messiness in one curated view (not the UI) was the right call.

---

# Post-Mortem — Visits ↔ Google Calendar feature (build + live validation)

**EVENT:** Designed and shipped the full "Agendar visita" feature (2026-06-26) — Calendar as source of truth, CRM as editor, with a templated invite + WhatsApp confirmation. Validated end-to-end in production by the user with his personal number.
**EXPECTED:** A "schedule a visit" button.
**ACTUAL:** A complete flow — guided journey (confirm property/date/time) → Google Calendar event (admin all-copy host + advisor attendee, lead_id tag) → CRM visita mirror → WhatsApp confirmation to the lead (maps/calendar/wa.me) → a 5-min `calendar_sync` reflecting reschedules/cancellations. Heavy iteration on the WhatsApp template.

## Timeline
- **Design** (over several turns): Calendar = source of truth ("not in Calendar = not scheduled"); the advisor lives in the **CRM + WhatsApp, not GSuite**, so the CRM/bot is the editor and Calendar the authoritative store (write-through); `visitas` is a queryable mirror; split ownership (Calendar owns scheduling, CRM owns resultado/notas).
- **Steps 1–6:** populate `sales.calendario` (primary email calendars; Josafat-advisor = josafat@, all-copy = administrador@) → `visitas.gcal_event_id`/`estado` → journey UI → `agendar_visita` edge fn (Calendar event) → WhatsApp send → `calendar_sync` (pg_cron).
- **Two diagnosed traps:** (1) **"No se pudo agendar" was CORS** — the function succeeded server-side but the browser couldn't read the response, so the UI showed an error and the user retried → duplicate events. (2) **The maps URL format**: `/maps/search/?api=1&query=` opened a broken search; `https://maps.google.com/?q=` (the property's `url_maps`) opens cleanly.
- **WhatsApp template churn:** can't preview buttons via free text; 2-URL-button limit (maps + calendar buttons, wa.me in body); edited the approved template (maps base + {{5}} wa.me) → Meta re-approved → validated.
- **Side root-cause fix:** the recurring "Pending" advisor name — `handle_update_user` wiped `sales.first_name` to 'Pending' on every login when auth metadata had no name; fixed to fall back to the existing name.

## 5 Whys (the headline trap: the lying error)
1. Why did "No se pudo agendar" show when the visit WAS created? → The browser blocked the response.
2. Why? → The edge function returned no CORS headers and didn't handle the OPTIONS preflight.
3. Why wasn't that caught? → The other edge functions are server-side (cron/trigger), which don't need CORS; this was the first browser-called one.
4. Why did it cause duplicates? → A false "failed" made the user retry, and each retry actually succeeded server-side.

**ROOT CAUSE:** A browser-invoked edge function without CORS — the success was real but invisible, turning one click into several phantom events.

## Contributing factors
- WhatsApp template constraints are non-obvious: free text can't show buttons, URL buttons cap at 2, and dynamic URL buttons only take a suffix — so a long maps URL must be a button (hidden) or coords.
- Template edits require Meta re-approval (minutes here, but a dependency).
- `derive_lead_stage` could have overridden an inserted S7 test lead, but didn't (it only derives S1–S4) — worth remembering when seeding test data.

## Warning signs / handled well
- Diagnosed CORS by the tell: **direct API call works, UI call fails** → not the logic, the browser.
- Validated every layer live: the raw calendar create/tag/query/delete; the function e2e (temp-phone to route a real WA to the user); the template render; and finally the **user's own end-to-end** with his personal number (the real acceptance test).
- Cleaned up all test events/visitas/leads from production afterward.

## In control vs out of control
**In control:** the design discipline (Calendar source of truth, split ownership, write-through), incremental step-by-step build with a live check each step, CORS/format fixes at the source.
**Out of control:** Meta template approval latency; WhatsApp URL-button quirks (the maps format); the legacy `handle_update_user` defaulting to 'Pending'.

## Change register
| Action | Owner | Due | Verification |
|---|---|---|---|
| Populate `propiedades` lat/lng → even shorter/bulletproof maps (`?q=lat,lng`) | backlog | when convenient | maps button drops an exact pin |
| New browser-called edge function → always add CORS + OPTIONS | process | every such fn | UI reads the response |
| New advisor → set `sales` name + `whatsapp` + `calendario` | process | every activation | name sticks; visits route to their calendar |

## One-line lesson
**A failed-looking UI can be a successful backend** — "No se pudo agendar" was a CORS lie while every click really created an event. Build incrementally, validate each layer live, and let the user's own end-to-end run be the acceptance test; the truth was in "direct call works, browser doesn't."
