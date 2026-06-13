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
