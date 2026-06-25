# Migration Strategy: Google Sheet → Supabase as single source of truth

**Status:** Proposed — agreed in principle, **not scheduled**. This document
captures the direction so we stop re-deciding it ad hoc.
**Last updated:** 2026-06-25
**Related:** `adr/ADR-TASK-013-sheet-sync-stage-frontier.md`

---

## TL;DR

The Google Sheet and the CRM (Supabase) are **two sources of truth fighting each
other**. Every recent data-quality fire is the same root cause. The right
direction is **Supabase as the single master, the bot reading/writing Supabase
directly, and the Sheet decommissioned (or kept only as a read-only export).**

We are **already migrating incrementally** — every fix has moved ownership of one
more field from the Sheet into the CRM. The decision here is to make that
deliberate and phased instead of continuing to patch reactively.

The hard part is **not the data** (already mirrored into Supabase every ~2 min).
The hard part is moving the **writers** — the WhatsApp bot in `~/inmovel/code` —
off the Sheet and onto Supabase. That is a bot change, high-risk because the bot
is live on customer conversations, and must be done incrementally with the
existing sync as a safety net.

---

## Current architecture

```
WhatsApp leads
     │
     ▼
  BOT (~/inmovel/code)  ──writes──►  Google Sheet (Leads, Conversaciones,
     ▲                               Propiedades, Asesores, Anuncios, NocNok)
     │ reads                              │
     └────────────────────────────┐      │ pg_cron every 2 min
                                   │      ▼
                                   │   sheet_sync edge function (one-way Sheet→DB)
                                   │      │
                                   │      ▼
                                   └──  Supabase (contacts, propiedades, …)
                                          │
                                          ▼
                                        CRM (React app)
```

- The **bot** is the primary writer. It uses the Sheet as its data layer.
- `sheet_sync/syncLeads.ts` mirrors the Sheet into Supabase **one-way**.
- The **CRM** increasingly owns data the bot/Sheet used to own (see ledger below).

## The core problem: two masters

The Sheet is a schema-less, weakly-typed store. When both it and the CRM can own
the same field, they diverge. Recent incidents, all the same bug:

| Incident (2026-06) | Symptom | Root cause |
|---|---|---|
| `asesor_nombre` corrupt (~108 rows) | Lead's chat message stored as the advisor name | Sheet has no typing; bot wrote message text into `asesor_asignado` |
| `telefono` NULL (62 leads) | Phone lost | Sheet left the cell empty |
| `stage` NULL (post-10-jun) | No pipeline stage | Sheet has **no stage column**; CRM must derive it |
| Advisor reassignment reverts | CRM reassignment undone every ~2 min | Sheet was source of truth for ≤S5 assignment; it overwrote the CRM |

Every fix so far has been the CRM **defending itself against the Sheet**. That
does not scale — with 20 advisors, more edge cases will surface.

## We are already migrating (the ownership ledger)

Ownership has been moving into the CRM one field at a time:

| Field / concern | Was | Now | Moved |
|---|---|---|---|
| `stage` (S6+) | Sheet | CRM-owned (frontier) | ADR-013 |
| `stage` (S1–S4) | Sheet (absent) | Derived in CRM from lead fields | 2026-06 |
| Advisor assignment (`sales_id`) | Sheet (≤S5) | **CRM-owned once set** (sync only assigns first-time) | 2026-06-25 |
| `asesor_nombre` | Raw Sheet value | Canonical name by id, CRM-cleaned | 2026-06-25 |
| `telefono` fallback | Sheet only | Derived from `sheet_id` when empty | 2026-06-25 |

The trajectory already points at Supabase-as-master. This plan just names it.

---

## What "migration" actually means

> Migrating is **not** copying data. The data is already in Supabase.
> Migrating is **moving the writers (the bot) off the Sheet onto Supabase**, and
> deciding what — if anything — the Sheet is still good for.

So the real work lives in `~/inmovel/code` (the bot), not in the CRM.

## The blocker / risk

The bot talks to leads on WhatsApp **in production**. Rewriting its data layer is
high-stakes: if it breaks, the operation breaks. Therefore:

- **No big-bang rewrite.** Incremental, writer-by-writer.
- **Keep the Sheet sync as a safety net** during the transition (dual-write).
- Move the **least contentious, already-half-owned** concerns first.

---

## Phased approach

### Phase 0 — Stop the bleeding (done / ongoing)
Each contested field is made CRM-owned defensively (stage, assignment,
asesor_nombre, telefono). This buys time and removes active fires. ✅ mostly done.

### Phase 1 — Dual-write from the bot
The bot writes each record to **both** Supabase (new path) and the Sheet (old
path). The `sheet_sync` stays on as reconciliation/safety net. Nothing reads the
new path yet. Low risk — purely additive.

### Phase 2 — Flip reads to Supabase
The bot starts **reading** the data it needs from Supabase instead of the Sheet,
table by table. Validate parity against the Sheet before each flip.

### Phase 3 — Decommission the Sheet as master
Once all bot reads/writes are on Supabase, turn off `sheet_sync`. The Sheet
becomes either gone or a **read-only export/dashboard** generated from Supabase
(not a writer).

## Tab-by-tab triage (suggested order)

| Tab | Priority | Notes |
|---|---|---|
| **Leads / Conversaciones / Stages** | **First** | Where all the fights are; CRM already semi-owns it. Highest payoff. |
| **Asesores** | Easy | Small table, low risk; good early win. |
| **Anuncios** | Easy | Small reference table. |
| **NocNok** | Whenever | External feed, mirror only — move the ingest, no ownership conflict. |
| **Propiedades (inventory)** | **Care** | The Sheet here is a **genuine human-editing UX** — the team edits properties in a spreadsheet. Decommissioning means building **property CRUD in the CRM** first. Medium priority, real product work. |

## Target end state

- **Supabase is the single master.** The bot reads and writes Supabase directly.
- The Sheet is **gone, or a read-only view** generated from Supabase.
- No two-way reconciliation; no field-ownership frontier needed for sync defense.
- Property editing has a first-class CRM UI (replaces the Propiedades Sheet UX).

## Open decisions (resolve when we schedule this)

1. **Property editing UX** — build CRUD in the CRM, or keep a Sheet-as-input just
   for Propiedades? This is the main reason not to kill the Sheet wholesale.
2. **Bot data-access layer** — a thin Supabase client module in the bot, or go
   through a small API? Affects how invasive the bot changes are.
3. **Cutover criteria per tab** — what parity check gates each read-flip.
4. **Who edits Asesores/Anuncios** post-Sheet — needs a home in the CRM.

## Why this is worth doing

Not migrating = an unbounded stream of "CRM defends itself from the Sheet"
patches, each one a new edge case, made worse at 20 advisors. Migrating = one
source of truth, typed and constrained, with the CRM as the system of record it
already half is.
