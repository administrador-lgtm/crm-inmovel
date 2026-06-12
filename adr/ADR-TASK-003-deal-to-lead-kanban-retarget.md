# ADR-TASK-003 — Retarget the Kanban board from deal onto lead (contact)

- **Date**: 2026-06-12
- **Ticket**: TASK-003
- **Session**: 4e3d9b5a

## Context

Inmovel manages post-handoff leads, not B2B deals. In this domain 1 lead = 1 person = 1
opportunity, so the pipeline stage belongs to the lead itself, not to a separate deal entity.
The deal entity is removed, but the Kanban board is a core advisor workflow and must survive.
Stages S1..S5 are owned by the WhatsApp-bot sync; S6..S10 and `descartado` are advisor-set.

## Decision

Drop the `deal`/`deal_note` entities entirely and add a `stage` column to `contacts` (a contact
IS the lead). Rebuild the board under `src/components/atomic-crm/leads/` reading the `contacts`
resource grouped by `stage`, mounted as a custom route at `/leads/kanban`. Drag persists only
`contact.stage`; drops into read-only columns (S1..S5) are blocked client-side.

## Consequences

- The stage lives on the lead, so there is no intra-column ordering index to maintain (simpler than the old deal board).
- The read-only S1..S5 frontier is enforced only in the UI here; server-side enforcement (RLS / sync guard) is deferred to TASK-014.
- Removing the deal entity touches many shared files (activity log, notes, providers, settings, i18n, schema); company files that referenced deals are cleaned defensively pending TASK-001's company removal.
- `leadStages` replaces `dealStages`/`dealCategories`/`dealPipelineStatuses` in configuration.

## Alternatives considered

- Keep `deal` as a thin per-lead opportunity table — rejected: duplicates the lead, contradicts the 1-lead-1-opportunity domain rule.
- Delete the board with the deal entity — rejected: the board is the primary advisor workflow and must survive.
