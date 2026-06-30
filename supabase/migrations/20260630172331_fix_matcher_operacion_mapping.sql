-- Fix: external inventory (NocNok/Lamudi) encodes operation as Sale/Rent/Sale+Rent;
-- map it to the lead profile's Spanish vocabulary (renta/venta/ambos) so external
-- tiers actually match. Before this, only own 'venta' properties matched.

create or replace view public.lead_property_matches with (security_invoker = on) as
with matchable as (
    select
        lmp.lead_id,
        public.normalize_text(lmp.operacion) as operacion,
        lmp.zonas,
        lmp.recamaras as lead_recamaras,
        public.normalize_text(lmp.tipo) as lead_tipo,
        -- ±15% band: floor protects a higher-budget lead from wrong-tier cheap
        -- product; ceiling caps at the stated maximum + 15%.
        coalesce(lmp.presupuesto_min, lmp.presupuesto_max) * 0.85 as price_floor,
        lmp.presupuesto_max * 1.15 as price_ceiling
    from public.lead_match_profile lmp
    where lmp.operacion in ('renta', 'venta')
      and lmp.presupuesto_max is not null
      and array_length(lmp.zonas, 1) >= 1
),
candidates as (
    -- Tier 1: own inventory
    select
        1 as tier,
        'own'::text as property_source,
        'own'::text as fuente,
        p.id as property_id,
        p.nombre as title,
        public.normalize_text(p.operacion) as operacion,
        p.precio,
        p.recamaras::int as recamaras,
        public.normalize_text(p.tipo) as tipo,
        p.colonia,
        p.alcaldia,
        p.url_ficha,
        p.url_anuncio,
        coalesce(p.is_exclusive, false) as is_exclusive
    from public.propiedades p
    where p.activa is not false
    union all
    -- Tier 2: qualified pool (NocNok), latest batch only
    select
        2,
        'nocnok'::text,
        'nocnok'::text,
        n.codigo,
        coalesce(nullif(n.title, ''), concat_ws(' · ', nullif(n.type_text, ''), nullif(n.colonia, ''))),
        -- External inventory encodes operation in English (Sale/Rent/Sale+Rent);
        -- map to the Spanish vocabulary the lead profile uses (renta/venta/ambos).
        case lower(n.operacion)
            when 'sale' then 'venta'
            when 'rent' then 'renta'
            when 'sale+rent' then 'ambos'
            else public.normalize_text(n.operacion)
        end,
        n.precio,
        n.recamaras::int,
        public.normalize_text(n.type_text),
        n.colonia,
        n.alcaldia,
        n.url_ficha,
        null::text,
        coalesce(n.is_exclusive, false)
    from public.nocnok_raw n
    where n.fecha_carga = (select max(fecha_carga) from public.nocnok_raw)
    union all
    -- Tier 3: rest (Lamudi), latest batch only
    select
        3,
        'lamudi'::text,
        'lamudi'::text,
        l.codigo,
        coalesce(nullif(l.title, ''), concat_ws(' · ', nullif(l.type_text, ''), nullif(l.colonia, ''))),
        -- Same English→Spanish operation mapping as the NocNok branch above.
        case lower(l.operacion)
            when 'sale' then 'venta'
            when 'rent' then 'renta'
            when 'sale+rent' then 'ambos'
            else public.normalize_text(l.operacion)
        end,
        l.precio,
        l.recamaras::int,
        public.normalize_text(l.type_text),
        l.colonia,
        l.alcaldia,
        l.url_ficha,
        null::text,
        coalesce(l.is_exclusive, false)
    from public.lamudi_raw l
    where l.fecha_carga = (select max(fecha_carga) from public.lamudi_raw)
)
select
    -- Stable composite id for react-admin (lead_id + source + property_id; the
    -- source disambiguates own vs external codes).
    (m.lead_id || '-' || c.property_source || '-' || c.property_id) as id,
    m.lead_id,
    c.property_id,
    c.property_source,
    c.tier,
    -- Soft rank: lower tier wins, then recamaras fit, tipo match, exclusivity.
    -- No row is excluded on these signals — they only reorder.
    (
        (100 - c.tier * 10)
        + case
            when m.lead_recamaras is null or c.recamaras is null then 0
            when c.recamaras = m.lead_recamaras then 20
            when abs(c.recamaras - m.lead_recamaras) = 1 then 5
            else -10
          end
        + case
            when m.lead_tipo <> '' and c.tipo <> '' and c.tipo = m.lead_tipo then 15
            else 0
          end
        + case when c.is_exclusive then 5 else 0 end
    )::numeric as rank_score,
    c.title,
    c.precio,
    c.recamaras,
    c.colonia,
    c.alcaldia,
    c.url_ficha,
    c.url_anuncio,
    c.is_exclusive,
    c.fuente
from matchable m
join candidates c
    -- 'ambos' (Sale+Rent listings) matches both renta and venta leads.
    on (c.operacion = m.operacion or c.operacion = 'ambos')
   and c.precio is not null
   and c.precio >= m.price_floor
   and c.precio <= m.price_ceiling
   -- Zona containment: at least one lead zona normalized-contained in the
   -- property's colonia OR alcaldia. EXISTS avoids fanning the join out per zona.
   and exists (
        select 1
        from unnest(m.zonas) as z
        where nullif(trim(z), '') is not null
          and (
            strpos(public.normalize_text(c.colonia), public.normalize_text(z)) > 0
            or strpos(public.normalize_text(c.alcaldia), public.normalize_text(z)) > 0
          )
   );
