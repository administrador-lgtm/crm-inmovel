# Inmovel CRM — Domain Brief (answer key for setup-interview)

This file pre-answers the 8 setup-interview domains for the Inmovel CRM. The orchestrator should
use it to fill `docs/project-context.json` (then validate with the user), instead of running a
cold discovery interview. Canonical product decisions live outside this repo in `~/inmovel/producto/output/`;
this is the distilled, English, build-facing version. Do not reopen decided items below.

> Runtime UI language is **Spanish**; all committed code/docs stay English (see `.claude/rules/english-only.md`).
> Domain *values* (e.g. `venta`, `renta`, colonia names) are runtime data and may be Spanish.

## Domain 1 — Business context
- Industry: residential real estate brokerage (CDMX / Mexico).
- Team size: 3–5 people. Client type: **B2C**.
- Objective: post-handoff lead management. A WhatsApp bot qualifies leads and hands them to human
  advisors; this CRM is where advisors operate those leads. Not a prospecting tool.

## Domain 2 — Entities
- **Extend `contact` → "lead".** In Inmovel 1 lead = 1 person = 1 opportunity (people rarely buy twice).
  The lead IS the opportunity: its pipeline `stage` lives on the lead, not on a separate deal.
- **Create `propiedad`** (property inventory, ~58 fields: own + shared/broker).
- **Create `asesor`** (advisor) — or map to Atomic `sales`/users.
- **Create `visita`** (visit: lead, property, date, result, notes).
- **Create `lead_propiedad`** (M:N lead↔property, relation type: `match_bot` | `pregunto` | `visito`).
- Keep `note` → "nota" (advisor note tied to a lead).
- Activity log = `conversacion` (the bot transcript; append-only).
- Read-only synced reference tables: `anuncio` (Meta ad → property), `nocnok_raw` (external feed).

## Domain 3 — Custom fields (highlights)
Lead custom fields (full field list: `~/inmovel/code/src/lib/schema.js`, 33 fields): `canal`, `fuente`,
`ad_id`, `zona_interes`, `presupuesto`, `ventana_compra`, `forma_compra`, `credito_status`,
`intencion_visita`, `fecha_visita_propuesta`, `asesor_asignado`, `propiedad_interes` (json),
`resumen_sales`. Plus CRM-only fields not in the Sheet:
- `stage` — enum S1..S10 + `descartado`.
- `handoff_trigger` — enum `perfil_completo` | `visita_detectada`.
- `motivo_descarte` — text/enum, required when stage = descartado (enum TBD; leave free-select for now).

## Domain 4 — Pipeline (kanban on leads, NOT deals)
Single stage per lead, mutually exclusive. **Keep the kanban but retarget it from `deal` to `lead`.**

| Stage | Name | Owner |
|---|---|---|
| S1 | Contacto | Auto (bot) |
| S2 | En conversación | Auto (bot) |
| S3 | Perfilando | Auto (bot) |
| S4 | Handoff ready | Auto (bot) |
| S5 | Handoff enviado | Auto (system) |
| S6 | Asesor aceptó | **Manual (CRM button)** |
| S7 | Visita agendada | Manual |
| S8 | Visita realizada | Manual |
| S9 | Negociación | Manual |
| S10 | Cierre | Manual (admin) |
| Descartado | Descartado (motivo obligatorio) | Manual |

Rules: S1–S5 are read-only in the CRM (set by sync). S6–S10 + Descartado are advisor-set. Stages can be
skipped. S7↔S8 is bidirectional (multiple visits). See **stage-ownership frontier** under Integrations.

## Domain 5 — User roles
- **Admin** — sees all; reassigns leads, global config.
- **Manager** — own leads + leads of advisors assigned to them; reassign within team.
- **Asesor** — only own leads; move stages S6–S10, notes, visit results.
- **Multi-tenant: YES.** Per-advisor isolation via Supabase RLS (`asesor_asignado` ↔ user), not frontend filters.

## Domain 6 — Integrations
- **No** standard email/Slack/CSV integration.
- **Custom — WhatsApp bot bridge (Phase B):** the bot keeps writing to Google Sheets. A one-way cron
  (every 1–2 min) syncs Sheet → Supabase for: leads, propiedades, conversaciones, anuncios, asesores,
  nocnok_raw. Never Supabase → Sheet.
- **Stage-ownership frontier (critical):** while a lead's `stage ≤ S5`, the sync computes/overwrites it.
  Once a lead reaches **S6**, the stage becomes CRM-owned and the sync MUST NOT overwrite it (guard on it).
  Advisor-only data (notas, visitas, motivo_descarte, manual handoff_trigger) is never touched by sync.
- No bidirectionality CRM → bot.

## Domain 7 — UI/UX
- Language: Spanish (runtime). Theme: **light only** (advisors use phones in daylight). No dark mode.
- Palette: primary `#4f46e5` (indigo), secondary `#764ba2`, light `#667eea`.
- No analytics dashboards yet (post-validation).

## Domain 8 — Deployment
- GitHub: `administrador-lgtm/crm-inmovel` (personal account; transferable later).
- Auth: Google OAuth restricted to `@inmovel.net`.
- Platform: **Railway**. Supabase project: TBD.

## Cleanup (remove from default Atomic CRM)
- `company` entity (no B2B layer).
- `deal` entity — but **keep the kanban**, retargeted onto leads (stage lives on the lead).
- `task` entity (deferred).
- `tag` entity (not used) — confirm with user.
- Analytics dashboard, CSV import/export (not needed now).

## Out of scope now (Phase A, future)
- Bot writing directly to Supabase (kills the sync, Sheet dies).
- Fixing the corrupt `asesor_asignado` bug (fixed in Phase A).
- SLAs / CRM-originated notifications.
