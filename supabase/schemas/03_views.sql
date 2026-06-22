--
-- Views
-- This file declares all views in the public schema.
--

create or replace view public.activity_log with (security_invoker = on) as
select
    ('contact.' || co.id || '.created') as id,
    'contact.created' as type,
    co.first_seen as date,
    co.sales_id,
    to_json(co.*) as contact,
    null::json as contact_note
from public.contacts co
union all
select
    ('contactNote.' || cn.id || '.created') as id,
    'contactNote.created' as type,
    cn.date,
    cn.sales_id,
    null::json as contact,
    to_json(cn.*) as contact_note
from public.contact_notes cn
    left join public.contacts co on co.id = cn.contact_id;

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
    co.stage_changed_at
from public.contacts co
group by co.id;

create or replace view public.init_state with (security_invoker = off) as
select count(sub.id) as is_initialized
from (
    select sales.id from public.sales limit 1
) sub;

create or replace view public.propiedades_summary with (security_invoker = on) as
select
    p.id,
    p.nombre,
    p.tipo,
    p.operacion,
    p.colonia,
    p.alcaldia,
    p.precio,
    p.recamaras,
    p.activa,
    p.fuente,
    p.broker_nombre,
    p.material_url
from public.propiedades p;

-- NocNok shared-inventory finder. The base table's primary key is `codigo`,
-- but react-admin needs an `id`; this view aliases it (and exposes only the
-- fields the CRM finder shows). security_invoker keeps nocnok_raw's RLS.
create or replace view public.nocnok with (security_invoker = on) as
select
    p.codigo as id,
    p.codigo,
    p.title,
    p.operacion,
    p.type_text,
    p.precio,
    p.recamaras,
    p.full_bathrooms,
    p.half_bathrooms,
    p.m2,
    p.lot_size,
    p.colonia,
    p.alcaldia,
    p.estado,
    p.cp,
    p.estacionamiento,
    p.year_built,
    p.levels,
    p.url_ficha,
    p.lat,
    p.lon,
    p.account_name,
    p.shared_commission,
    p.is_exclusive,
    p.share_type,
    p.status_days,
    p.status_date,
    p.fotos,
    p.broker_tel,
    p.broker_wa
from public.nocnok_raw p
-- Only the latest refresh batch. The sync upserts but never deletes, so old
-- listings NocNok has dropped accumulate in the base table; filtering to the
-- most recent fecha_carga keeps the finder showing only current inventory.
where p.fecha_carga = (select max(fecha_carga) from public.nocnok_raw);

create or replace view public.conversaciones_by_lead with (security_invoker = on) as
select
    c.id,
    c.lead_id,
    c.rol,
    c.texto,
    c.timestamp,
    c.nombre_lead
from public.conversaciones c
order by c.timestamp asc;
