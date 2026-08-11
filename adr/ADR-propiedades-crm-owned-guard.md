# ADR — Propiedades crm_owned ownership guard

## Status
Accepted

## Context
Advisors now capture properties directly in the CRM, but `sheet_sync` still
mirrors the Sheet's Propiedades tab into Supabase every ~2 min as a blind
full upsert. Without a guard, any CRM write would be clobbered on the next
sync tick. The lead table already solved this with the stage-ownership
frontier (ADR-TASK-013); propiedades needs the same "CRM-owned once set"
idea, but per-row instead of per-field.

## Decision
A `crm_owned boolean not null default false` column marks row ownership:

- The CRM Create form stamps `crm_owned = true` (plus
  `lifecycle_status = 'draft'`, `created_by`, `fuente = 'crm'`).
- `sheet_sync` pre-fetches the ids of `crm_owned` rows and filters them out
  of the Sheet upsert — CRM rows are never overwritten by the mirror.
- RLS allows authenticated INSERT/UPDATE only where `crm_owned = true`, so
  Sheet-origin rows are read-only in the CRM at the DB level (the sync runs
  as service_role and bypasses RLS). The Edit page shows a notice instead of
  the form for those rows.
- `lifecycle_status` gates matching: only `matchable` / `consultor_active`
  rows enter the `lead_property_matches` own-inventory tier. The default
  `consultor_active` preserves the status quo for sync-inserted rows.

Gating of the `consultor_active` status (bot exposure) is **UI-only**: the
Edit form offers it exclusively to admins (`useCanAccess` on `sales`), but
RLS does not restrict which lifecycle values a non-admin can write. Accepted
tradeoff for a 5-person internal team; revisit with a column-level check or
trigger if the team grows.

## Consequences
- Advisors can create and edit their own inventory without racing the sync.
- Sheet-origin rows (OM636, OM536, ...) keep exactly one writer (the bot via
  the Sheet) until the bot read-flip, so zero bot/CRM divergence.
- Every sync tick pays one extra paginated id fetch on propiedades (cheap at
  current volume, ~hundreds of rows).
- When the bot flips to reading Supabase, the propiedades sync (and this
  guard's sync half) can be retired; `crm_owned` remains as provenance.
