# MEMORY

Durable Atomic CRM knowledge. One sentence per bullet, freshest first. Maintained by the `documentator` agent — see [.claude/agents/documentator.md](.claude/agents/documentator.md).

## Business Knowledge

- Core resources: contacts, companies, deals (Kanban pipeline), tasks, notes, tags, and sales (team members).
- Domain options (genders, sectors, deal stages/categories, note statuses, task types) are `<CRM>` props in `src/App.tsx`, not hardcoded.
- Sales users sync with Supabase `auth.users` via triggers; deletion is unsupported — accounts are disabled instead.
- Aggregated reads use database views (`contacts_summary`, `companies_summary`), which FakeRest emulates in the frontend.
- Two interchangeable data providers: Supabase (production) and FakeRest (in-browser demo, resets on reload).
- Filters use `ra-data-postgrest` syntax (`field_name@operator`); operators must be supported by the FakeRest `supabaseAdapter`.

## Inmovel deployment (2026-06-13)

- Inmovel CRM is LIVE: Railway `crm-web` (https://crm-web-production-6d3c.up.railway.app) + Supabase project `crm-inmovel` (ref yvowokyomykvntupibpp, us-west-1). Google OAuth web client `1088362139074-unil6i...` (NOT the bot's gkjhvg client). See docs/HANDOFF.md.
- Schema was applied to the fresh remote by running supabase/schemas/*.sql directly via the `postgres` npm client over the session pooler (aws-1-us-west-1, port 5432) — no Docker locally. supabase/seed.sql seeds the singleton configuration row (its absence caused a 406 that blocked app init).
- The sheet_sync edge function mints a Google access token from GOOGLE_REFRESH_TOKEN per run (not a static token); runs every 2 min via pg_cron + pg_net. Secrets set via `supabase secrets set`.
- Sync field mapping: Sheet nombre/nombre_completo→first_name/last_name, telefono→phone_jsonb, created_at→first_seen, asesor_asignado(name)→asesor_nombre (display-only text column; the RLS bigint asesor_asignado is CRM-set). desarrollo_activo and tipo_busqueda are synced and shown in the leads list.
- Deploy-time gotchas that typecheck can't catch: forward-ref FKs (move to ALTER), strict enum CHECK constraints reject real NocNok data (drop them on synced tables), child-table FKs need sheet-id→contacts.id resolution, and the configuration table must be seeded + publicly readable.
- Lesson: only a real deploy (live Supabase + real Sheet data) surfaced the 7 worst bugs; typecheck-green is necessary but not sufficient.
