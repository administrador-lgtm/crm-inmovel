# Property Matcher — Design (v1)

Status: **built and validated on `session/a0bdbf4c`, pending promotion to main + DB deploy** (2026-06-30). Originally recovered after a mid-session crash the same day.

## What it does

Cross each lead's extracted search profile (`lead_match_profile`) against the
property inventory (own `propiedades` + external `inventario_externo`) and surface
ranked candidate properties per lead.

## Inputs (already built)

- `lead-profile-extract.cjs` — LLM (Haiku) extractor. Reads each lead's WhatsApp
  transcript from `conversaciones`, writes a structured profile.
- `lead_match_profile` table (live, 1,935 rows): `lead_id, operacion, zonas[],
  presupuesto_min, presupuesto_max, recamaras, tipo, confianza, evidencia, fuente,
  model, raw, extracted_at`.

## Coverage reality (measured 2026-06-30 on 1,935 profiled leads)

| Requirement | Leads | % |
|---|---|---|
| operacion (renta/venta) | 1,419 | 73.3% |
| **presupuesto_max** | **602** | **31.1%** ← bottleneck |
| ≥1 zona | 1,727 | 89.3% |
| **Strict: op + precio + zona** | **589** | **30.4%** |

Key insight: **zona is nearly free (89%); price is the wall (69% null).** Requiring
zona on top of op+precio drops only 7 leads. The lever to raise coverage later is
better budget extraction, not loosening zona.

Strict set by operacion: 415 venta, 174 renta.

## v1 decisions (LOCKED)

- **"Matchable" minimum:** `operacion ∈ {renta, venta}` AND `presupuesto_max NOT NULL`
  AND `≥1 zona`. The other ~1,346 leads are excluded from the matcher. No queue, no
  follow-up for now ("por ahora nada").
- **Rent price band:** ±15% around the lead's range.
  - floor = `coalesce(presupuesto_min, presupuesto_max) × 0.85`
  - ceiling = `presupuesto_max × 1.15`
  - Floor exists to avoid showing wrong-tier cheap product to a higher-budget renter.
- **v1 universe:** the 589 strict leads only.

- **Sale price band:** ±15% symmetric (same as rent, for consistency).
  floor = `coalesce(presupuesto_min, presupuesto_max) × 0.85`, ceiling = `presupuesto_max × 1.15`.

- **Match target — 3 tiers, ranked in this order:**
  | Tier | Source | N | Rationale |
  |---|---|---|---|
  | 1. Own | `propiedades` | 34 | Own inventory, top priority |
  | 2. Qualified pool ("bolsa calificada") | `inventario_externo` fuente=nocnok | 714 | Co-broke (shared_commission) + has fotos; `is_exclusive` ranks first within tier |
  | 3. Rest | `inventario_externo` fuente=lamudi | 3,067 | Scraped marketplace, no co-broke |

  Signals measured 2026-06-30: Nocnok = 714 all with fotos, 426 with shared_commission,
  63 exclusive. Lamudi = 3,067, no shared_commission, no fotos metadata.

- **Zona matching:** normalize (lowercase, unaccent, trim) and match each lead `zona`
  against property `colonia` OR `alcaldia` by containment. Alias map (e.g. "Del Valle" ↔
  "Benito Juárez") deferred to v2.

- **recamaras / tipo:** soft refinement (rank boost / penalty), NOT a hard filter. A lead
  asking 2 bedrooms still sees 3-bedroom options, ranked lower.

- **Surfacing:** "Propiedades sugeridas" section on the **lead ficha**. Global `/matcher`
  screen deferred to v2.

- **Lead kanban card badge:** the lead card shows a visual distintivo when the matcher
  found ≥1 property for that lead. Needs a cheap per-lead match-count signal the card can read.

## Still open (technical, decide at build time)

- Where it runs: SQL view (`lead_property_matches` joining `lead_match_profile` to a UNION
  of `propiedades` + `inventario_externo` with per-lead band + zona logic) vs edge function
  vs scheduled script. Leaning SQL view + a lightweight aggregate for the card badge.
