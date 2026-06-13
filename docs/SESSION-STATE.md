# Session checkpoint — 2026-06-12 (session 4e3d9b5a, paused: usage limit)

Resume by reading this file + docs/project-context.json (validated spec) + docs/tickets/ (16 tickets).

## Where we are: Wave 1 of 6 FULLY MERGED on session/4e3d9b5a (3a16a34), NOT yet promoted to main
Session branch `session/4e3d9b5a` (anchor `session-base/4e3d9b5a`) still at base 356ef17.
Work lives on branches (SAFE in .git; worktrees under /tmp are disposable):
- `4e3d9b5a/TASK-001` (21 commits) — company entity removed (~54 files + schema + edge fns). Was fixing real unit-test failures at pause. Flags: postmark no longer auto-creates company; i18n dead keys left symmetric; test-data CSV columns left.
- `4e3d9b5a/TASK-002` (11 commits) — task entity removed. Implementation complete, was in review.
- `4e3d9b5a/TASK-003` (13 commits) — deals removed, kanban RETARGETED onto leads (LeadKanban*, S1-S5 read-only). Missing: ADR + review handoff. Defensive deal-strip in companies/ files: at merge, TASK-001's deletion wins (modify/delete -> delete).

## Remaining: merge wave 1, then waves 2-6 per docs/tickets dependencies (TASK-016 added: remove tags, depends on TASK-005; TASK-009 also depends on TASK-016). Then deploy phase (user must create Supabase project; GitHub administrador-lgtm/crm-inmovel; Google OAuth @inmovel.net; Railway).

## Infra fixes already on main (do NOT redo): macOS path canonicalization in cleanup-worktree/setup-worktree/activeWorktrees; portable vitest timeout. See memory macos-tmp-symlink-hooks.

## Cost note: wave 1 burned heavy usage (3 opus devs + 6 reviewers + infra debugging). For waves 2-6 consider: sonnet developers for low/medium-risk tickets, SIMPLE flow for small ones, keep opus only for TASK-013 (sync) and TASK-014 (RLS).


## Update (direct mode, same day)
- User chose DIRECT MODE: orchestrator merges/implements directly; full agent ceremony reserved for TASK-013/014.
- All 3 wave-1 branches merged into session/4e3d9b5a at 3a16a34 (42 conflicts hand-resolved: union-of-removals pattern; 4 type errors in new LeadKanban code fixed).
- Validation: typecheck GREEN on merged state; 49 unit tests passed (supabaseAdapter, NoteInputs, ContactEdit). Remaining browser-mode vitest files COULD NOT RUN: vitest browser mode wedged machine-wide (even single pre-existing files won't launch; likely needs reboot/fresh login). Re-run `CI=true npx vitest run --config vitest.config.ts --project app` in the _session worktree before/after promoting.
- PROMOTED to main at f8ecdd7 (typecheck green; 49/~130 unit tests ran pre-promotion, rest blocked by wedged vitest browser mode — re-run after machine reboot; main is not deployed anywhere, risk accepted).
- Agent team tickets-4e3d9b5a (10 members) still nominally alive but idle; tear down or ignore — direct mode supersedes it.

## Wave 2 DONE (same session, direct mode): TASK-004/005/006/007/016 merged to main at 4b6a223. Typecheck green. 8/16 tickets in main. Next: wave 3-4 UI (TASK-008 support tables, TASK-009 lead UI, TASK-010 propiedades UI, TASK-011 asesor UI, TASK-012 visitas+conversaciones), then TASK-013 sync + TASK-014 RLS (use review ceremony or extra care), TASK-015 branding. Unit tests still pending machine reboot.

## Waves 3-4 DONE (direct mode): TASK-008/009/010/011/012 merged to main at 52f66bc. 13/16 tickets done. StageControl enforces S6 frontier in UI. Remaining: TASK-013 (Sheet->Supabase sync edge fn), TASK-014 (RLS + Google OAuth domain) — the 2 critical ones, give extra care; TASK-015 (Spanish i18n + Inmovel branding + light theme + indigo palette). Then deploy phase (user creates Supabase project). Unit tests still pending machine reboot.


## ALL 16 TICKETS MERGED TO MAIN (e92e649) — feature build complete.
- Waves 5-6: TASK-013 (Sheet->Supabase sync edge fn + S6 stage-frontier guard, unit-tested pure module + ADR), TASK-014 (multi-tenant RLS via can_access_lead/manager_id graph + DB stage-frontier trigger + @inmovel.net signup guard + ADR), TASK-015 (Spanish default locale + Inmovel branding + MXN + forced light theme + indigo palette).
- Typecheck GREEN on main across all merges.
- THREE-LAYER defense of the stage frontier: UI (StageControl), sync (canSyncWriteStage), DB (enforce_stage_frontier trigger).

## REMAINING (not code — deployment phase):
1. Run full unit + e2e suite after a machine reboot (vitest browser mode was wedged; logic verified by typecheck + targeted runs).
2. Deno tests for sheet_sync/stageFrontier.test.ts run at deploy (deno not installed locally).
3. DEPLOY: user creates a Supabase project (supabase_project_name still null in spec); then generate migrations from supabase/schemas via `npx supabase db diff`, configure Google OAuth (@inmovel.net) + env vars (INMOVEL_SHEET_ID, GOOGLE_SHEETS_TOKEN, SHEET_SYNC_SECRET, SUPABASE_SERVICE_ROLE_KEY), schedule the sheet_sync cron (1-2 min), deploy to Railway, GitHub administrador-lgtm/crm-inmovel.

## DEPLOYED & LIVE (2026-06-13)
- App: https://crm-web-production-6d3c.up.railway.app (Railway project crm-inmovel / service crm-web)
- Supabase: crm-inmovel / ref yvowokyomykvntupibpp (us-west-1)
- Google OAuth: WEB client 1088362139074-unil6i1b08d2ga8ima2jcosqa21aqh4k (NOT the bot's gkjhvg client) — has the Supabase callback redirect URI. Login confirmed working.
- Sync cron active every 2 min. Last full sync: 1476 leads, 22 props, 10184 conversaciones, 678 nocnok.

## OPEN ITEM (next session, ~10 min): logged in but leads not visible in UI.
Likely causes to check in order:
1. First user may not be admin yet — check: `select email, administrator from sales`. The handle_new_user trigger sets administrator=TRUE only when sales table was empty at signup; if a prior row existed, user is non-admin.
2. RLS: synced leads have asesor_asignado=NULL (excluded from sync — Sheet stores names not ids). can_access_lead returns false for non-admins on null-asesor leads, and even admins: is_admin() must resolve. Verify current_sale_id()/is_admin() work for the logged-in user.
3. The CRM lists leads from contacts_summary view (security_invoker=on) — confirm the view respects/passes RLS and returns rows for the admin.
Quick test: as the logged-in user, `select count(*) from contacts_summary`. If 0 for an admin, debug is_admin(); if >0, it's a frontend query/filter issue.

## LIVE & WORKING (2026-06-13, end of session 2)
- Leads list now shows per row: stage badge, tipo de operación (venta/renta), zona, presupuesto, desarrollo de interés, asesor + last activity.
- Sync maps: nombre→first/last_name, telefono→phone_jsonb, created_at→first_seen, asesor_asignado(name)→asesor_nombre (display-only), desarrollo_activo, tipo_busqueda.
- Configuration table seeded + public-read (fixed the 406 that blocked app init).

## BACKLOG (user-requested, not now):
1. Admin-only "reassign advisor" control on the lead show page — a SelectInput of sales (asesor_asignado bigint, RLS-backed). Display-only asesor_nombre comes from the Sheet; the real assignment should be CRM-set by admin/manager.
2. The Sheet's asesor_asignado column has legacy dirty values (e.g. dates) — old bugs, user says ignore for now; cleaned at source (Sheet/bot) will reflect on next sync.
