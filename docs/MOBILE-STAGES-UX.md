# Mobile stages UX — design note (not implemented yet)

**Status:** Documented principle, **not built**. Agreed 2026-06-25. The current
mobile "Leads" tab just opens the desktop drag-and-drop kanban, which is awkward
on a phone (≈11 stage columns don't fit; dragging across columns is painful).

## The principle

> On mobile, **separate viewing from moving**: you *view* leads as a list
> filtered/grouped by stage, and you *change* a lead's stage from inside its
> detail view — never by dragging across columns. The horizontal kanban board
> stays desktop-only.

This is what Pipedrive / HubSpot / Salesforce mobile all do.

## Standard patterns

**Viewing leads by stage (pick one):**
1. **Stage chips + vertical list** — a horizontally-scrollable row of stage chips
   (S1, S2, S3 …) at the top; tap one → the list shows that stage's leads. (Most
   common — Pipedrive mobile.)
2. **Grouped collapsible list** — one vertical scroll, leads grouped under
   collapsible stage section headers. Good for an overview.
3. Either way, **the stage shows as a colored badge** on each row.

**Changing a lead's stage:** a stage **dropdown / stepper** on the lead detail
("Cambiar etapa" / "Avanzar"). The advisor opens the lead and changes the stage
there. No drag-and-drop.

## Recommendation for this app (Inmovel)

Reuse what already exists; minimal new components:

1. **Mobile "Leads" tab → list + stage chips.** Point the mobile bottom-nav
   "Leads" (`MobileNavigation.tsx`, currently `/leads/kanban`) at the mobile list
   (`ContactListMobile`) with a top row of stage chips that filter by `stage`.
   Reuses the list, the stage badge, and the stage config (`defaultLeadStages`).
2. **Stage picker on the lead detail** (`ContactShow`) to move a lead — **only
   from S6 onward**. S1–S5 are sync-owned (the bot/derive trigger owns them and
   they're read-only in the CRM); only S6+ is advisor-controlled, so the picker
   must be gated to S6+ to avoid writing a stage the next sync would fight.

Net effect: advisors get a usable pipeline on the phone without fighting drag,
and stage changes respect the ownership frontier.

## Why not just keep the kanban on mobile

It already "works" (the route is registered as of 2026-06-25, no more 404), but
drag-and-drop on a touch screen with ~11 narrow columns is poor UX. Keep the
kanban as the desktop view; give mobile the list+picker pattern above when we
decide to build it.
