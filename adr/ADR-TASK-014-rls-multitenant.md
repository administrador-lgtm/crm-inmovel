# ADR-TASK-014 — Multi-tenant RLS and @inmovel.net OAuth restriction

## Status
Accepted

## Context
Advisors must only see their own leads; managers also see the leads of advisors
who report to them; admins see everything. Sign-in is via Google OAuth and must
be limited to the company domain. Isolation must be enforced server-side, not by
frontend filters.

## Decision
**Per-advisor isolation via RLS.** Row visibility is decided by a single
SECURITY DEFINER helper, `can_access_lead(asesor bigint)`:
- admin → true (all rows)
- otherwise → the lead's `asesor_asignado` is the current user's sales id, OR
  belongs to an advisor whose `manager_id` is the current user's sales id.

This means we do **not** need a separate "manager" role flag: a plain advisor
has no reports, so the same policy collapses to "own leads only", while a
manager (someone other advisors point to via `manager_id`) automatically gains
their team's leads. One policy, two behaviors, derived from the org graph.

Contacts, visitas, lead_propiedad and conversaciones are all scoped through
`can_access_lead` (the child tables join back to the parent lead). Propiedades,
anuncios and nocnok_raw are shared reference data: SELECT to all authenticated.

**Stage frontier at the DB.** A `before update` trigger
(`enforce_stage_frontier`) rejects any CRM attempt to set a lead's stage into
the sync-owned range S1..S5. The sync runs as service_role (`auth.uid()` is
null) and bypasses it; CRM users (authenticated) are policed. This is the
server-side complement to the UI guard in StageControl and the sync guard in
TASK-013 — three layers defending the same invariant.

**Domain restriction.** `handle_new_user` rejects any sign-up whose email is not
`@inmovel.net`, enforcing the OAuth domain limit at the database regardless of
the Supabase Auth provider configuration.

## Consequences
- Adding/removing a manager relationship is just setting `manager_id` on the
  advisor's sales row — no policy changes.
- The frontend `canAccess` only gates which screens are reachable (admins get
  the users/configuration screens); all row-level scoping is RLS's job, so the
  client can never widen a user's data access.
- Local FakeRest dev does not enforce RLS, so manager-vs-advisor row scope is
  only observable against a real Supabase backend.
