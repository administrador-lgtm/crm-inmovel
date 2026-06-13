# Inmovel CRM — Handoff / Operations (PM closeout 2026-06-13)

A WhatsApp bot qualifies leads into a Google Sheet; this CRM is where advisors
operate those leads post-handoff. Built from Atomic CRM, retargeted to the
Inmovel real-estate domain.

## Live URLs & accounts
- **App:** https://crm-web-production-6d3c.up.railway.app
- **Login:** Google OAuth, restricted to `@inmovel.net`. First user to sign in becomes admin.
- **Supabase project:** `crm-inmovel` / ref `yvowokyomykvntupibpp` (us-west-1)
- **Railway project:** `crm-inmovel` / service `crm-web`
- **Secrets (local, gitignored):** `.supabase-db-password.txt`, `.sheet-sync-secret.txt`

## What it does
- **Leads** = contacts (1 lead = 1 person = 1 opportunity). Pipeline stage lives on the lead.
- **Kanban** on leads: stages S1..S10 + Descartado. S1–S5 are read-only (bot/sync-owned); S6–S10 + Descartado are advisor-set in the CRM.
- **Properties** (propiedades): own + shared/broker (NocNok) inventory.
- **Visits** (visitas) and the **bot conversation** transcript show on each lead.
- Leads list shows per row: stage, operation type (venta/renta), zona, presupuesto, desarrollo de interés, asesor, last activity.

## How the data flows (the sync)
- One-way **Google Sheet → Supabase**, every 2 min via pg_cron → `sheet_sync` edge function. Never writes back to the Sheet.
- **Stage-ownership frontier (critical):** the sync sets a lead's stage only while it is S1–S5. Once an advisor moves it to S6+, the sync never overwrites the stage again. Enforced in 3 layers: UI (StageControl), sync (`canSyncWriteStage`), and a DB trigger (`enforce_stage_frontier`).
- To clean synced data (names, asesor, etc.): edit the **Sheet** (source of truth). Editing Supabase is undone on the next sync tick.
- Advisor-only data (notes, visits, motivo_descarte, manual handoff_trigger) is never touched by the sync.

## Security
- Multi-tenant RLS: admins see all; everyone else sees their own leads + the leads of advisors who report to them (`sales.manager_id` graph), via `can_access_lead`.
- `@inmovel.net` enforced at the DB (`handle_new_user`) regardless of OAuth config.

## What to watch while testing
- Stage moves S6→S10/Descartado should stick across sync ticks (the frontier).
- New Sheet leads appear within ~2 min.
- The `asesor` shown is the Sheet's text value (display-only), which has some legacy dirty entries — ignore for now.

## Backlog (agreed, not done)
1. **Admin-only "reassign advisor"** on the lead show page — a SelectInput of sales writing `asesor_asignado` (bigint, RLS-backed). This is the real, permanent assignment; `asesor_nombre` is just the Sheet display value.

## Operating notes
- Re-run the sync manually: `POST` the `sheet_sync` function with header `x-sync-secret` (value in `.sheet-sync-secret.txt`).
- Redeploy frontend: `railway up` from repo root. Redeploy function: `npx supabase functions deploy sheet_sync --project-ref yvowokyomykvntupibpp`.
- Schema source of truth is `supabase/schemas/*.sql`. The live DB was built by applying those directly (no Docker locally); `supabase/seed.sql` seeds the configuration row.
- To resume work next session: read `docs/SESSION-STATE.md` + this file.
