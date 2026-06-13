# ADR-TASK-013 — One-way Sheet→Supabase sync and the stage-ownership frontier

## Status
Accepted

## Context
The WhatsApp bot qualifies leads and writes them to a Google Sheet. The CRM
must operate those leads in Supabase, but the bot continues to own the Sheet as
its source of truth during Phase B. We need the Sheet's data in Supabase
without ever writing back to the Sheet, and without the periodic sync clobbering
the work advisors do inside the CRM.

## Decision
A scheduled Edge Function (`sheet_sync`, cron every 1–2 min) reads the Sheet
tabs and upserts them into Supabase. It is strictly one-way (Sheet → Supabase;
never Supabase → Sheet).

The central invariant is the **stage-ownership frontier**, isolated in a pure,
unit-tested module (`stageFrontier.ts`):

- A lead's `stage` is sync-owned while it is in **S1..S5** (computed by the bot).
- Once an advisor accepts the handoff (`stage = S6`) the stage becomes
  **CRM-owned** and the sync must never overwrite it again — including
  `descartado`.
- The decision keys off the **DB** stage, not the incoming Sheet stage: after a
  lead crosses to S6+, the Sheet's stage column is ignored for that row.
- Advisor-owned columns (`motivo_descarte`, `handoff_trigger`) and advisor-owned
  tables (`visitas`, notes) are never written by the sync.

Leads are keyed on a `sheet_id` column on `contacts` so the upsert is
idempotent. Reference tables (propiedades, conversaciones, anuncios, nocnok_raw)
have no frontier — they are full reference upserts on their primary keys.

## Consequences
- Advisors can move a lead through S6..S10/descartado and trust the CRM not to
  revert it on the next sync tick.
- The frontier logic is the highest-risk line in the system, so it lives in one
  small pure function with its own test suite rather than being inlined in the
  upsert loop.
- A future Phase where the bot writes directly to Supabase would retire this
  function entirely; until then the Sheet remains authoritative for S1..S5.
