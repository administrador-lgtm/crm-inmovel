# ADR-TASK-001 — lead_property_matches scoped via lead_match_profile RLS (invoker)

- **Date**: 2026-06-30
- **Ticket**: TASK-001
- **Session**: a0bdbf4c

## Context

The Property Matcher view crosses each lead's `lead_match_profile` (budget/zona
intent) against the property inventory. That intent is private per lead — a
non-admin advisor must only read matches for leads they own. The profile table
existed only in the live DB (bot-extracted), undeclared and ungranted, with no
RLS.

## Decision

Declare `lead_match_profile` in the schema and give it its own per-lead SELECT
policy (`can_access_lead` through `contacts`, the exact shape used by
`conversaciones`). Keep `lead_property_matches` as `security_invoker = on`: the
invoker view re-applies that table policy, so reads are automatically scoped to
the caller's leads. The inventory tables (`propiedades`, `nocnok_raw`,
`lamudi_raw`) are team-wide reference data, so the profile is the only sensitive
input and it is gated at its source. `normalize_text()` uses `translate()` rather
than the `unaccent` extension (not enabled; single-arg `unaccent` needs the
dictionary on `search_path`, which fails under invoker views).

## Consequences

- No IDOR: an advisor querying the view (or the base table directly) only ever
  sees their own leads' matches — the RLS policy holds on every access path.
- The boundary lives on `lead_match_profile`, not in the view body; the view
  carries no `WHERE`/JOIN scope of its own, mirroring how `conversaciones` is
  consumed.
- Deliberately the opposite of `visitas_agenda` (definer, team-wide) — the
  matcher is per-lead-private.
- Bot writes are unaffected (the extractor runs as postgres/service_role, which
  bypasses RLS). No new runtime dependency — accent folding ships as plain SQL.

## Alternatives considered

- `security_invoker = off` (definer) gating inside with `can_access_lead`, like
  `advisor_conversation`: rejected — it hides the scope in the view body, whereas
  table-level RLS is reusable and also protects direct base-table access.
- `unaccent` extension for zona normalization: rejected — not enabled, unreliable
  on `search_path` inside an invoker view.
