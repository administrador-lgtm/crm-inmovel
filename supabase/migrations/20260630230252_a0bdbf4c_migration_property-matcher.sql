-- Property Matcher v1
--
-- Adds the infrastructure the lead-property matching feature needs:
--   1. normalize_text() — accent/case-insensitive text helper (no extension deps)
--   2. lead_match_profile — per-lead search-intent table (CREATE IF NOT EXISTS:
--      the table already exists in production with live rows; this is a no-op for
--      those environments and a clean create for fresh ones)
--   3. RLS + policy on lead_match_profile (same shape as conversaciones)
--   4. lead_property_matches view — the scorer that crosses lead profiles against
--      own/nocnok/lamudi inventory in three ranked tiers
--   5. contacts_summary recreated with match_count appended at end (PostgreSQL
--      requires CREATE OR REPLACE to only append; shifting existing ordinals fails)
--   6. Grants for the new table and view

-- ---------------------------------------------------------------------------
-- 1. normalize_text helper
-- ---------------------------------------------------------------------------
-- Accent/case-insensitive text normalizer for zona ↔ colonia/alcaldia
-- containment. Built on translate() so it has zero extension dependencies
-- (unaccent requires a text-search dictionary that is absent under
-- security_invoker views). IMMUTABLE: safe in indexed predicates. NULL in → ''.
CREATE OR REPLACE FUNCTION "public"."normalize_text"("input" text) RETURNS text
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select lower(trim(translate(coalesce(input, ''),
    'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')));
$$;

-- ---------------------------------------------------------------------------
-- 2. lead_match_profile table
-- ---------------------------------------------------------------------------
-- Bot-extracted per-lead search intent (budget/zona/tipo). One row per lead.
-- CREATE IF NOT EXISTS: in production this table already exists with 1935 rows
-- (created out-of-band); this statement is a deliberate no-op there.
CREATE TABLE IF NOT EXISTS public.lead_match_profile (
    lead_id bigint PRIMARY KEY REFERENCES public.contacts(id) ON DELETE CASCADE,
    operacion text,
    zonas text[],
    presupuesto_min numeric,
    presupuesto_max numeric,
    recamaras int,
    tipo text,
    confianza numeric,
    evidencia text,
    fuente text,
    model text,
    raw jsonb,
    extracted_at timestamp with time zone DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3. RLS on lead_match_profile
-- ---------------------------------------------------------------------------
-- ENABLE ROW LEVEL SECURITY is idempotent (no-op if already enabled).
ALTER TABLE public.lead_match_profile ENABLE ROW LEVEL SECURITY;

-- Drop-and-recreate is safe: one policy, no other dependents on the policy itself.
DROP POLICY IF EXISTS "Lead match profile selectable for accessible leads" ON public.lead_match_profile;

-- Read-only, scoped to accessible leads via can_access_lead (same shape as
-- the conversaciones policy). This policy IS the security boundary for
-- lead_property_matches (security_invoker = on), so reading the view
-- re-applies it and only returns matches for leads the caller owns.
CREATE POLICY "Lead match profile selectable for accessible leads"
    ON public.lead_match_profile
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.contacts c
            WHERE c.id = lead_match_profile.lead_id
              AND public.can_access_lead(c.asesor_asignado)
        )
    );

-- ---------------------------------------------------------------------------
-- 4. Grants on lead_match_profile
-- ---------------------------------------------------------------------------
GRANT ALL ON TABLE public.lead_match_profile TO anon;
GRANT ALL ON TABLE public.lead_match_profile TO authenticated;
GRANT ALL ON TABLE public.lead_match_profile TO service_role;

-- ---------------------------------------------------------------------------
-- 5. lead_property_matches view
-- ---------------------------------------------------------------------------
-- Crosses matchable lead profiles against own/nocnok/lamudi inventory in three
-- ranked tiers. security_invoker = on so the caller's read re-applies
-- lead_match_profile's RLS (see policy above). Reads raw tables directly so it
-- can be declared before contacts_summary consumes match_count from it.
-- See adr/ADR-TASK-001-lead-property-matches-security.md for the security model.
CREATE OR REPLACE VIEW public.lead_property_matches WITH (security_invoker = on) AS
WITH matchable AS (
    SELECT
        lmp.lead_id,
        public.normalize_text(lmp.operacion) AS operacion,
        lmp.zonas,
        lmp.recamaras AS lead_recamaras,
        public.normalize_text(lmp.tipo) AS lead_tipo,
        -- ±15% price band
        COALESCE(lmp.presupuesto_min, lmp.presupuesto_max) * 0.85 AS price_floor,
        lmp.presupuesto_max * 1.15 AS price_ceiling
    FROM public.lead_match_profile lmp
    WHERE lmp.operacion IN ('renta', 'venta')
      AND lmp.presupuesto_max IS NOT NULL
      AND array_length(lmp.zonas, 1) >= 1
),
candidates AS (
    -- Tier 1: own inventory (top priority)
    SELECT
        1 AS tier,
        'own'::text AS property_source,
        'own'::text AS fuente,
        p.id AS property_id,
        p.nombre AS title,
        public.normalize_text(p.operacion) AS operacion,
        p.precio,
        p.recamaras::int AS recamaras,
        public.normalize_text(p.tipo) AS tipo,
        p.colonia,
        p.alcaldia,
        p.url_ficha,
        p.url_anuncio,
        COALESCE(p.is_exclusive, false) AS is_exclusive
    FROM public.propiedades p
    WHERE p.activa IS NOT false
    UNION ALL
    -- Tier 2: qualified pool (NocNok), latest batch only
    SELECT
        2,
        'nocnok'::text,
        'nocnok'::text,
        n.codigo,
        COALESCE(NULLIF(n.title, ''), CONCAT_WS(' · ', NULLIF(n.type_text, ''), NULLIF(n.colonia, ''))),
        public.normalize_text(n.operacion),
        n.precio,
        n.recamaras::int,
        public.normalize_text(n.type_text),
        n.colonia,
        n.alcaldia,
        n.url_ficha,
        null::text,
        COALESCE(n.is_exclusive, false)
    FROM public.nocnok_raw n
    WHERE n.fecha_carga = (SELECT max(fecha_carga) FROM public.nocnok_raw)
    UNION ALL
    -- Tier 3: Lamudi, latest batch only
    SELECT
        3,
        'lamudi'::text,
        'lamudi'::text,
        l.codigo,
        COALESCE(NULLIF(l.title, ''), CONCAT_WS(' · ', NULLIF(l.type_text, ''), NULLIF(l.colonia, ''))),
        public.normalize_text(l.operacion),
        l.precio,
        l.recamaras::int,
        public.normalize_text(l.type_text),
        l.colonia,
        l.alcaldia,
        l.url_ficha,
        null::text,
        COALESCE(l.is_exclusive, false)
    FROM public.lamudi_raw l
    WHERE l.fecha_carga = (SELECT max(fecha_carga) FROM public.lamudi_raw)
)
SELECT
    -- Stable composite id for react-admin
    (m.lead_id || '-' || c.property_source || '-' || c.property_id) AS id,
    m.lead_id,
    c.property_id,
    c.property_source,
    c.tier,
    -- Soft rank: tier wins first, then recamaras fit, tipo match, exclusivity
    (
        (100 - c.tier * 10)
        + CASE
            WHEN m.lead_recamaras IS NULL OR c.recamaras IS NULL THEN 0
            WHEN c.recamaras = m.lead_recamaras THEN 20
            WHEN abs(c.recamaras - m.lead_recamaras) = 1 THEN 5
            ELSE -10
          END
        + CASE
            WHEN m.lead_tipo <> '' AND c.tipo <> '' AND c.tipo = m.lead_tipo THEN 15
            ELSE 0
          END
        + CASE WHEN c.is_exclusive THEN 5 ELSE 0 END
    )::numeric AS rank_score,
    c.title,
    c.precio,
    c.recamaras,
    c.colonia,
    c.alcaldia,
    c.url_ficha,
    c.url_anuncio,
    c.is_exclusive,
    c.fuente
FROM matchable m
JOIN candidates c
    ON c.operacion = m.operacion
   AND c.precio IS NOT NULL
   AND c.precio >= m.price_floor
   AND c.precio <= m.price_ceiling
   -- Zona containment: at least one lead zona is contained in colonia OR alcaldia
   AND EXISTS (
        SELECT 1
        FROM unnest(m.zonas) AS z
        WHERE NULLIF(trim(z), '') IS NOT NULL
          AND (
            strpos(public.normalize_text(c.colonia), public.normalize_text(z)) > 0
            OR strpos(public.normalize_text(c.alcaldia), public.normalize_text(z)) > 0
          )
   );

-- ---------------------------------------------------------------------------
-- 6. Grants on lead_property_matches
-- ---------------------------------------------------------------------------
GRANT ALL ON TABLE public.lead_property_matches TO anon;
GRANT ALL ON TABLE public.lead_property_matches TO authenticated;
GRANT ALL ON TABLE public.lead_property_matches TO service_role;

-- ---------------------------------------------------------------------------
-- 7. contacts_summary — add match_count at the end
-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE appends match_count as position N+1 so no existing column
-- ordinal shifts (PostgreSQL would reject any shift with error 42P16). The
-- correlated scalar subquery is acceptable at this scale (~600 matchable leads,
-- <4000 properties) and is read per-kanban-page, not for every row.
CREATE OR REPLACE VIEW public.contacts_summary WITH (security_invoker = on) AS
SELECT
    co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.sales_id,
    co.linkedin_url,
    co.email_jsonb,
    co.phone_jsonb,
    (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'))::text AS email_fts,
    (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'))::text AS phone_fts,
    co.stage,
    co.canal,
    co.fuente,
    co.nombre,
    co.nombre_completo,
    co.telefono,
    co.estado,
    co.desarrollos,
    co.desarrollo_activo,
    co.ad_id,
    co.zona_interes,
    co.presupuesto,
    co.tipo_busqueda,
    co.total_mensajes,
    co.historial_json,
    co.ventana_compra,
    co.forma_compra,
    co.credito_status,
    co.fecha_visita_propuesta,
    co.intencion_visita,
    co.asesor_asignado,
    co.mensajes_post_handoff,
    co.resumen_sales,
    co.renta_seleccion_pendiente,
    co.renta_seleccion_confirmada,
    co.propiedad_interes,
    co.asesor_externo,
    co.asesor_externo_tel,
    co.alerta_broker_externo_enviada,
    co.fecha_transicion_consultor,
    co.fecha_ultimo_contacto,
    co.handoff_trigger,
    co.motivo_descarte,
    co.sheet_id,
    co.asesor_nombre,
    -- Numeric form of presupuesto for range filtering and sorting. The raw
    -- column is free text; the regex guard keeps only clean integers/decimals
    -- and maps everything else to NULL. Appended at the end of the select list
    -- so CREATE OR REPLACE VIEW can add it without reordering existing columns.
    CASE
        WHEN co.presupuesto ~ '^[0-9]+(\.[0-9]+)?$' THEN co.presupuesto::numeric
        ELSE null
    END AS presupuesto_num,
    co.stage_changed_at,
    -- Readable name of the lead's active property of interest.
    max(prop.nombre) AS desarrollo_activo_nombre,
    -- Count of suggested properties for the lead (Property Matcher). Lets the
    -- kanban card render a "tiene matches" badge without re-running the matcher
    -- join. Appended last so no existing column ordinal shifts.
    (SELECT count(*) FROM public.lead_property_matches lpm WHERE lpm.lead_id = co.id) AS match_count
FROM public.contacts co
LEFT JOIN public.propiedades prop ON prop.id = co.desarrollo_activo
GROUP BY co.id;
