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
    co.stage_changed_at,
    -- Readable name of the lead's active property of interest (the kanban card
    -- shows it instead of the redundant stage badge). desarrollo_activo holds the
    -- property id (own slug or nocnok code), both present in propiedades.
    max(prop.nombre) as desarrollo_activo_nombre
from public.contacts co
left join public.propiedades prop on prop.id = co.desarrollo_activo
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
    p.broker_wa,
    -- Numeric coordinates for server-side bounding-box filtering (the raw
    -- columns are text; string comparison would order coords wrong).
    case when p.lat ~ '^-?[0-9.]+$' then p.lat::numeric end as lat_num,
    case when p.lon ~ '^-?[0-9.]+$' then p.lon::numeric end as lng_num
from public.nocnok_raw p
-- Only the latest refresh batch. The sync upserts but never deletes, so old
-- listings NocNok has dropped accumulate in the base table; filtering to the
-- most recent fecha_carga keeps the finder showing only current inventory.
where p.fecha_carga = (select max(fecha_carga) from public.nocnok_raw);

-- Distinct colonias of the current NocNok inventory, for the finder's
-- multi-select zone filter (id = colonia so it maps straight to `colonia@in`).
create or replace view public.nocnok_colonias with (security_invoker = on) as
select colonia as id, colonia, count(*)::int as n
from public.nocnok
where colonia is not null and colonia <> ''
group by colonia;

-- Unified external inventory: NocNok + Lamudi in one shape, discriminated by
-- `fuente`. The CRM finder shows ONE source at a time (a master Nocnok/Lamudi
-- selector sets `fuente@eq`); the feeds are never mixed in a single list
-- because their data quality differs. Each side is filtered to its own latest
-- fecha_carga (the syncs upsert but never delete). `title` falls back to
-- "tipo · colonia" because Lamudi rows often have no title. id = codigo (codes
-- are source-prefixed: NN-… / LM-…, so they don't collide across feeds).
create or replace view public.inventario_externo with (security_invoker = on) as
select
    'nocnok'::text as fuente,
    p.codigo as id, p.codigo,
    coalesce(nullif(p.title, ''), concat_ws(' · ', nullif(p.type_text, ''), nullif(p.colonia, ''))) as title,
    p.operacion, p.type_text, p.precio, p.recamaras, p.full_bathrooms, p.half_bathrooms,
    p.m2, p.lot_size, p.colonia, p.alcaldia, p.estado, p.cp, p.estacionamiento,
    p.year_built, p.levels, p.url_ficha, p.lat, p.lon, p.account_name,
    p.shared_commission, p.is_exclusive, p.share_type, p.status_days, p.status_date,
    p.fotos, p.broker_tel, p.broker_wa,
    case when p.lat ~ '^-?[0-9.]+$' then p.lat::numeric end as lat_num,
    case when p.lon ~ '^-?[0-9.]+$' then p.lon::numeric end as lng_num
from public.nocnok_raw p
where p.fecha_carga = (select max(fecha_carga) from public.nocnok_raw)
union all
select
    'lamudi'::text as fuente,
    p.codigo as id, p.codigo,
    coalesce(nullif(p.title, ''), concat_ws(' · ', nullif(p.type_text, ''), nullif(p.colonia, ''))) as title,
    p.operacion, p.type_text, p.precio, p.recamaras, p.full_bathrooms, p.half_bathrooms,
    p.m2, p.lot_size, p.colonia, p.alcaldia, p.estado, p.cp, p.estacionamiento,
    p.year_built, p.levels, p.url_ficha, p.lat, p.lon, p.account_name,
    p.shared_commission, p.is_exclusive, p.share_type, p.status_days, p.status_date,
    p.fotos, p.broker_tel, p.broker_wa,
    case when p.lat ~ '^-?[0-9.]+$' then p.lat::numeric end as lat_num,
    case when p.lon ~ '^-?[0-9.]+$' then p.lon::numeric end as lng_num
from public.lamudi_raw p
where p.fecha_carga = (select max(fecha_carga) from public.lamudi_raw);

-- Distinct colonias per source, for the finder's multi-select zone filter
-- (scoped by `fuente@eq` to match the active master source).
create or replace view public.inventario_externo_colonias with (security_invoker = on) as
select fuente, colonia as id, colonia, count(*)::int as n
from public.inventario_externo
where colonia is not null and colonia <> ''
group by fuente, colonia;

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

-- Readable inbox of @mention notifications for the bell (lead name, sender,
-- note text). security_invoker keeps note_mentions' per-recipient RLS.
create or replace view public.note_mentions_inbox with (security_invoker = on) as
select m.id, m.note_id, m.contact_id, m.recipient_id, m.sender_id, m.created_at, m.read_at,
    coalesce(c.nombre, c.first_name) as lead_name,
    n.text as note_text,
    trim(s.first_name || ' ' || coalesce(s.last_name, '')) as sender_name,
    trim(sr.first_name || ' ' || coalesce(sr.last_name, '')) as recipient_name
from public.note_mentions m
left join public.contacts c on c.id = m.contact_id
left join public.contact_notes n on n.id = m.note_id
left join public.sales s on s.id = m.sender_id
left join public.sales sr on sr.id = m.recipient_id;

-- Advisor↔lead WhatsApp transcript captured by the Baileys listener
-- (`wa_listener` schema, not exposed to the API). This curated view in public is
-- the ONLY bridge: it joins the listener's raw_messages -> chats -> contacts,
-- normalizing the device number to its last 10 digits (the listener's number/jid
-- formats aren't fully consistent yet). SECURITY DEFINER (security_invoker off)
-- so it can read wa_listener without granting the API roles access to that
-- schema; access is gated by `can_access_lead` in the WHERE so each advisor only
-- sees their own leads' conversations. Requires:
--   grant select on public.advisor_conversation to authenticated, anon;
create or replace view public.advisor_conversation with (security_invoker = off) as
select
    rm.id,
    co.id as lead_id,
    rm.from_advisor,
    rm.text,
    to_timestamp(rm.ts) as sent_at,
    c.advisor_sales_id
from wa_listener.raw_messages rm
join wa_listener.chats c
    on right(regexp_replace(c.number, '\D', '', 'g'), 10)
     = right(regexp_replace(rm.number, '\D', '', 'g'), 10)
   and (c.lid = rm.chat_id or c.phone = rm.chat_id)
join public.contacts co on co.id = c.contact_id
where public.can_access_lead(co.asesor_asignado)
  and rm.text is not null and rm.text <> '';

-- Visits Agenda — one flat row per scheduled visit with the lead, advisor, and
-- property context the agenda screen needs in a single read. asesor_id/asesor_name
-- come from the lead's owning advisor (contacts.asesor_asignado), NOT
-- visitas.asesor_id, so the agenda always reflects the current lead owner. stage
-- is the lead's pipeline stage (contacts.stage); estado is the visit's calendar
-- status (visitas.estado).
--
-- security_invoker = off (definer): the agenda is intentionally team-wide read.
-- Running as the view owner bypasses the per-advisor RLS on the joined contacts
-- table so EVERY authenticated user sees ALL visits (with lead name/phone,
-- advisor and property) — the agreed "open team, read-only" model. It exposes
-- only these agenda columns; the underlying contacts/sales tables stay
-- RLS-restricted for every other access path. Scheduling/editing visits remains
-- gated by visitas INSERT/UPDATE RLS (see 05_policies.sql).
create or replace view public.visitas_agenda with (security_invoker = off) as
select
    v.id,
    v.fecha,
    v.lead_id,
    coalesce(c.nombre, c.first_name) as lead_name,
    c.phone_jsonb as lead_phone,
    c.asesor_asignado as asesor_id,
    trim(s.first_name || ' ' || coalesce(s.last_name, '')) as asesor_name,
    v.propiedad_id,
    p.nombre as propiedad_name,
    p.url_maps,
    v.estado,
    c.stage
from public.visitas v
join public.contacts c on c.id = v.lead_id
left join public.sales s on s.id = c.asesor_asignado
left join public.propiedades p on p.id = v.propiedad_id;
