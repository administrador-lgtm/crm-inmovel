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
- PROMOTION PENDING: merge session/4e3d9b5a into main when tests run clean (or user accepts risk).
- Agent team tickets-4e3d9b5a (10 members) still nominally alive but idle; tear down or ignore — direct mode supersedes it.
