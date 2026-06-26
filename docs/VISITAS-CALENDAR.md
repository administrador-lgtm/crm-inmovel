# Visits ↔ Google Calendar — design note

**Status:** Design agreed (2026-06-26), **v1 not built yet**. Today `visitas`
exists but is unused (0 rows, manual-only `VisitasPanel`), advisor Google
Calendars are set up but `sales.calendario` is empty.

## Invariant

> **Google Calendar is the source of truth for scheduled visits. If it's not in
> Calendar, the visit is not scheduled.**

**The advisor lives in the CRM + WhatsApp, not GSuite.** So a visit is created
AND managed (reschedule / cancel) from the CRM (v1) or the bot (v2), which **write
through** to Calendar. Calendar is the authoritative store of record — it powers
reminders, bot availability, admin visibility, and the invariant above — but the
advisor never has to open Google Calendar. `visitas` in Postgres is the
**queryable read-mirror**, derived from Calendar, never the master.

Write path: **CRM/bot → Calendar (authoritative) → mirror into `visitas`.** The
advisor edits in the CRM; every edit lands in Calendar first, then flows down to
the mirror — so there is one write surface (CRM/bot) and one source of truth
(Calendar), no two-master conflict.

## Why Calendar is the source (and why this differs from the Sheet)

Not everything should move *into* Supabase. The **Sheet we want to kill** (Supabase
is a better home). **Calendar we keep** — it's genuinely the right tool to schedule
(reminders, mobile, the advisor already lives there). So:
- Sheet → replace (move into Supabase).
- Calendar → keep as source, **mirror** into Supabase.

We still need the `visitas` mirror in Postgres because the Calendar API is
event-by-event, not relational: the CRM needs SQL/joins (visita ↔ lead ↔ propiedad
↔ stage), reporting (visits per advisor, visit→close conversion), RLS, and speed
(reading Calendar on every ficha render is slow + rate-limited).

## Ownership split (same discipline as the stage frontier)

- **Scheduling fields (date/time, location, status):** edited in the CRM/bot,
  **written through** to Calendar (the store of record), then mirrored back into
  `visitas`. Calendar is authoritative; the CRM is the editor. A Calendar→CRM pull
  stays as a safety net for out-of-band edits (e.g. admin moving an event directly).
- **CRM-owned outcome (the sync NEVER overwrites):** `resultado` (how the visit
  went), `notas` (post-visit), and the lead/propiedad link. Same anti-clobber rule
  as `sales_id`/`stage`.

## The linking mechanism (the crux)

A Calendar event must carry the lead reference, set **at creation** by something
that knows it (CRM/bot — never a freehand event in Calendar):

- On the event: `extendedProperties.private = { lead_id, propiedad_id }` (invisible,
  queryable via `privateExtendedProperty`).
- On the CRM row: `visitas.gcal_event_id` (the event id). ← needs a new column.

The pair links both ways. The sync lists events by the tag (or reads each event's
`extendedProperties`) and upserts `visitas` keyed on `gcal_event_id`.

**Gotcha:** an event created by hand in Calendar has no tag → not auto-linkable.
v1 only links CRM-created events; a phone-in-title fallback is possible later.

## Flows

**v1 — CRM (manual, now):** "Agendar visita" is a short guided **journey** on the
ficha that makes the advisor confirm the key fields (so clean data is captured at
the moment of scheduling, instead of trusting whatever the lead carried):

1. **Propiedad** — dropdown, default = the lead's `desarrollo_activo`, overridable
   (a lead may visit a different property than their entry ad). Drives the address.
   *Optional:* write the confirmed property back to the lead's `desarrollo_activo`
   with the CRM-owned-once-set guard (same anti-revert pattern as `sales_id`) so the
   journey also cleans the lead's data.
2. **Fecha** — date picker (default = `fecha_visita_propuesta` if present).
3. **Hora** (+ duration, default 1h).
4. **Preview** — the advisor sees the composed invite (title, address, body) AND
   the WhatsApp message the lead will get → **Confirm**.

The **summary is composed from the confirmed fields** — nothing invented. On
confirm the CRM:
- **Creates the event in the advisor's calendar** (`sales.calendario`), advisor as
  `attendee` (`sales.email`, linked), with templated `summary` /`description` /
  `location` (teléfono, presupuesto, zona, ventana/forma de compra, resumen, ficha
  deep-link `/l/{lead_id}` — degrades gracefully when fields are missing) and
  `extendedProperties.private.lead_id/propiedad_id`; saves `gcal_event_id`.
- **Triggers a WhatsApp confirmation to the lead** (bot/WABA) — "Tu visita a
  {propiedad} quedó agendada para {fecha}…". Same pipeline as `notify_mention` (DB
  trigger → edge function → WABA template). Needs an approved visit-confirm template.
- `calendar_sync` then mirrors the event back into `visitas` for the ficha.

**v2 — bot (future):** the visit falls out of the conversation, two paths:
1. **Bot directly with the lead** (consulting the advisor/broker first for
   availability — like the old "brokeros" flow), books straight into the broker's
   calendar.
2. **Bot on the advisor's request.**
Both create the same tagged event; the CRM button stays as a manual fallback.

## Existing infrastructure (already in place)

- Advisor group calendars under `administrador@inmovel.net`, read/write/delete
  validated — IDs in `~/inmovel/code/references/google-calendar-asesores.md`
  (Luis Gerardo, Josafat, shared "Visitas JAAC").
- OAuth token already has the `calendar` scope (same GOOGLE_CLIENT_ID/SECRET/
  REFRESH_TOKEN used by the Sheet sync).
- `sales.calendario` column exists (empty — to populate with each advisor's
  Calendar ID). Calendar = the advisor's/broker's own calendar (per-advisor), with
  admin subscribed to all.

## Phase 1 scope (when we build)

1. Populate `sales.calendario` with each advisor's Calendar ID (IDs already exist
   in `google-calendar-asesores.md`). `sales.email` is already linked.
2. Add `visitas.gcal_event_id` (text, unique) for the mirror key.
3. "Agendar visita" on the ficha → an edge function does Calendar `events.insert`
   in `sales.calendario`: advisor as `attendees` (`sales.email`), templated
   `summary`/`description`/`location` from the lead+propiedad, and
   `extendedProperties.private.lead_id/propiedad_id`; save the returned event id as
   `gcal_event_id`.
4. **WhatsApp confirmation to the lead** on schedule: DB trigger → edge function →
   WABA template (same pipeline as `notify_mention`). Needs one approved
   visit-confirmation template (es_MX).
5. pg_cron edge function `calendar_sync`: read each `sales.calendario`, upsert
   `visitas` by `gcal_event_id` (date/time/status/location), **never touching**
   `resultado`/`notas` (split ownership).
6. Ficha/kanban read `visitas` (panel already exists).
