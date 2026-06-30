# ADR-TASK-001 — lead_property_matches uses security_invoker (not definer)

- **Date**: 2026-06-30
- **Ticket**: TASK-001
- **Session**: a0bdbf4c

## Context

The Property Matcher view joins each lead's `lead_match_profile` against the
property inventory. Matches expose a lead's budget/zona intent, so a non-admin
advisor must only ever read matches for leads they own. Two precedents exist in
this codebase: `contacts_summary` (invoker) and `visitas_agenda` (definer, for a
deliberately team-wide read).

## Decision

Declare `lead_property_matches` with `security_invoker = on`. The view holds no
RLS itself; it is only read joined to a lead the caller can already see (through
`contacts_summary` / `contacts` RLS via `can_access_lead`), so running as the
invoker keeps every row inside the caller's lead scope. The companion
`normalize_text()` helper uses `translate()` rather than the `unaccent`
extension (not enabled; its single-arg form needs the `unaccent` dictionary on
`search_path`, which fails under invoker views).

## Consequences

- Advisors never read matches for leads outside their RLS scope — no client-side
  filtering needed, no definer escape hatch to audit.
- `lead_match_profile` carries no row-level policy; the security boundary is the
  JOIN to `contacts`, exactly as with `contacts_summary`. If that table later
  gains RLS, the invoker view inherits it for free.
- Deliberately the opposite choice from `visitas_agenda` (definer): the matcher
  is per-lead-private, not a shared team agenda.
- No new runtime dependency — accent folding ships as a plain SQL function.

## Alternatives considered

- `security_invoker = off` (definer, like `visitas_agenda`): rejected — it would
  bypass `contacts` RLS and leak other advisors' lead intent.
- `unaccent` extension for zona normalization: rejected — not enabled, and
  unreliable on `search_path` inside an invoker view.
