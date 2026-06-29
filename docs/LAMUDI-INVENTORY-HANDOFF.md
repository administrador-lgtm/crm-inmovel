# Handoff — Add Lamudi external inventory (+ rename "Bolsa compartida" → "Nocnok")

**Status:** spec / decision — ready for the CRM build to pick up.
**Input:** new Supabase table `public.lamudi_raw` (3067 rows as of 2026-06-29).

## Requirement (from product)

- A new top-nav tab **"Lamudi"** that loads `lamudi_raw` inventory.
- Rename the existing **"Bolsa compartida"** tab → **"Nocnok"**.
- Keep the two **separate tabs** for now (Nocnok and Lamudi browsed independently).

## Key fact that drives the design

`lamudi_raw` has the **same column shape** the `nocnok` view consumes
(`codigo, title, operacion, type_text, precio, recamaras, full_bathrooms,
half_bathrooms, m2, lot_size, colonia, alcaldia, estado, cp, estacionamiento,
year_built, levels, url_ficha, lat, lon, account_name, shared_commission,
is_exclusive, share_type, status_days, status_date, fotos, broker_tel,
broker_wa, activa, fecha_carga`). It only adds `fuente` (='lamudi'),
`descripcion`, `detalle_url`. So the finder/map components need **no new shape**.

The CRM never reads `*_raw` directly — it reads the `nocnok` view (+
`nocnok_colonias` for the zone filter) and the components live in
`src/components/atomic-crm/nocnok/`.

## Decision — unified view, two tabs (RECOMMENDED)

Build **one** view `public.inventario_externo` = `nocnok_raw` (fuente='nocnok')
`UNION ALL` `lamudi_raw` (fuente='lamudi'), each already filtered to its own
latest `fecha_carga`, exposing the existing `nocnok`-view columns + `lat_num`/
`lng_num` + a `fuente` discriminator. Add `inventario_externo_colonias`
(grouped by `fuente, colonia`) for the zone filter.

The **two tabs reuse the same components** (List/Map/Show), each passing a fixed
`fuente` filter (`fuente@eq=nocnok` / `fuente@eq=lamudi`). This satisfies
"separate tabs" without duplicating any React code.

Why not a separate `lamudi` view mirroring `nocnok`: it would duplicate the view
*and* force the nocnok components to be generalized per-resource anyway. The
union is the same generalization work with one view instead of two and a clean
path to later merging the tabs into a single combined finder if desired.

## Build steps (CRM repo)

1. **Schema** (`supabase/schemas/03_views.sql`):
   - `inventario_externo` view: refactor the current `nocnok` SELECT into a
     UNION ALL over `nocnok_raw` (literal `'nocnok' as fuente`) and `lamudi_raw`
     (`fuente`), each with its own `where fecha_carga = (select max(fecha_carga)
     from <table>)`. Keep `codigo as id` — note `id` must stay unique across
     both feeds (codes are already source-prefixed: `LM-…` for Lamudi); if a
     collision is ever possible, key as `fuente || ':' || codigo`.
   - `inventario_externo_colonias`: `select fuente, colonia as id, colonia,
     count(*) from inventario_externo group by fuente, colonia`.
   - Keep `nocnok` / `nocnok_colonias` as thin wrappers (or repoint components)
     to avoid breaking anything mid-migration.
   - Grants in `06_grants.sql`.
2. **Components** (`src/components/atomic-crm/nocnok/` → consider renaming to
   `inventario/`): accept a `fuente` prop so List/Map/Show + the colonias filter
   scope to one source. Types in `nocnok/types.ts` already match.
3. **Resource + routes** (`root/CRM.tsx`): register the view resource; two custom
   routes `/nocnok` and `/lamudi` rendering the same list with the right `fuente`.
4. **Nav** (`layout/Header.tsx` + i18n): rename `crm.navigation.nocnok`
   "Bolsa compartida" → **"Nocnok"**; add `crm.navigation.lamudi` = **"Lamudi"**
   tab → `/lamudi`. Mind nav width in Spanish (the bar wraps now — keep it that
   way). Mobile nav: add Lamudi to the bottom bar only as part of the deferred
   mobile-nav redesign, not a 8th cramped item.
5. Verify in **Spanish** (advisors' locale), not just English.

## Deploy

DB view applied to live Supabase (same path as `visitas_agenda`); frontend via
`railway up`. Advisors must hard-reload (PWA cache).
