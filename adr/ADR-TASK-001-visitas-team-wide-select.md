# ADR-TASK-001 — Visitas SELECT loosened to team-wide reads

- **Date**: 2026-06-26
- **Ticket**: TASK-001
- **Session**: 042b6fd6

## Context

The Visits Agenda screen must show the whole team's scheduled visits, but the
visitas SELECT policy was `can_access_lead`-gated (own-lead-only), matching the
multitenant RLS convention from ADR-TASK-014. That convention is too narrow for
an agenda that is meant to be a shared, team-wide view.

## Decision

Replace the visitas SELECT policy with `using (true)` for the `authenticated`
role (idiomatic "all authenticated" read, same as propiedades/sales). INSERT and
UPDATE stay `can_access_lead`-gated, so writes remain advisor-scoped. The new
`visitas_agenda` view is `security_invoker = on`, so it inherits this policy.

## Consequences

- Any logged-in user can read all visits (id, fecha, lead name/phone, advisor,
  property, estado, stage) — acceptable since this is an internal team tool.
- Writes are unchanged: only advisors who can access the parent lead can
  insert/update a visit.
- Deliberate, documented departure from the per-advisor read isolation in
  ADR-TASK-014, scoped to the visitas table only.

## Note — baseline repair

To pass the validate-before-review gate, TASK-001 also had to repair a
pre-existing baseline failure on the session branch (unrelated to the RLS/view
change): `google.maps` types missing from `tsconfig.app.json`'s `types` array,
`Contact` MessageSchema/fake-generator drift, a deprecated `DrawingManager` API
in `NocnokMap.tsx` (stripped from `@types/google.maps@3.65`) typed via a localized
cast, and stale `i18nProvider.test.ts` assertions (the app now registers an `es`
locale and defaults to Spanish). Committed separately (`fix: repair pre-existing
typecheck baseline …`); the security review focuses on the SQL.

## Alternatives considered

- Keep `can_access_lead` on SELECT and filter client-side: rejected — would hide
  other advisors' visits, defeating the team-wide agenda.
- Manager-graph scope (`can_access_lead` reuse): rejected — the agenda is meant
  for the whole team, not just a manager's reports.
