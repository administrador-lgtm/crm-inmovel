-- Performance fix: lead_property_matches is heavy (~20s full scan). Computing
-- match_count as a correlated subquery over it per contact row timed out the
-- kanban and contact list. Precompute counts in a materialized view and have
-- contacts_summary read them via an indexed lookup. The matview is refreshed
-- hourly by the pg_cron job 'inmovel-match-counts-refresh' (managed out-of-band
-- alongside inmovel-sheet-sync / inmovel-calendar-sync).

create materialized view if not exists public.lead_match_counts as
    select lead_id, count(*)::int as match_count
    from public.lead_property_matches
    group by lead_id;

create unique index if not exists lead_match_counts_lead_id_idx
    on public.lead_match_counts (lead_id);

create or replace view public.contacts_summary with (security_invoker = on) as
select
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
    (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'))::text as email_fts,
    (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'))::text as phone_fts,
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
    -- column is free text (mixes monthly-rent and total-sale amounts, and may
    -- hold non-numeric values like "consultar" or "NaN"); the regex guard keeps
    -- only clean integers/decimals and maps everything else to NULL. Note the
    -- guard is required because Postgres accepts 'NaN'::numeric. Appended at the
    -- end of the select list so CREATE OR REPLACE VIEW can add it without
    -- reordering existing columns.
    case
        when co.presupuesto ~ '^[0-9]+(\.[0-9]+)?$' then co.presupuesto::numeric
        else null
    end as presupuesto_num,
    co.stage_changed_at,
    -- Readable name of the lead's active property of interest (the kanban card
    -- shows it instead of the redundant stage badge). desarrollo_activo holds the
    -- property id (own slug or nocnok code), both present in propiedades.
    max(prop.nombre) as desarrollo_activo_nombre,
    -- Count of suggested properties for the lead (Property Matcher). Lets the
    -- kanban card render its "tiene matches" badge cheaply without re-running the
    -- matcher join. Correlated scalar subquery — acceptable at this scale (~600
    -- matchable leads, <4000 properties).
    (select lmc.match_count::bigint from public.lead_match_counts lmc where lmc.lead_id = co.id) as match_count
from public.contacts co
left join public.propiedades prop on prop.id = co.desarrollo_activo
group by co.id;
