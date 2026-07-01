-- Flag advisor-owned (S6+) leads the advisor has never contacted via Baileys.
-- Adds contacts.advisor_last_contact_at, stamped by the extended sync_human_last_seen
-- trigger; contacts_summary exposes it; the kanban card shows a red badge when a
-- human-stage lead has none.

-- Track the last time an advisor contacted the lead via Baileys (any stage).
-- null = advisor has never reached out. Used to flag human-stage leads with 0
-- advisor contact on the kanban.
alter table public.contacts add column if not exists advisor_last_contact_at timestamptz;

-- Extend the Baileys trigger: every advisor->lead outbound stamps
-- advisor_last_contact_at (monotonic, any stage); human-stage last_seen unchanged.
create or replace function public.sync_human_last_seen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead_id bigint;
  v_ts timestamptz;
begin
  if new.from_advisor is not true or coalesce(new.text, '') = '' then
    return new;
  end if;

  v_ts := to_timestamp(new.ts::double precision);

  select co.id
    into v_lead_id
  from wa_listener.chats c
  join public.contacts co on co.id = c.contact_id
  where right(regexp_replace(c.number, '\D', '', 'g'), 10)
        = right(regexp_replace(new.number, '\D', '', 'g'), 10)
    and (c.lid = new.chat_id or c.phone = new.chat_id)
  limit 1;

  if v_lead_id is not null then
    -- Record advisor contact regardless of stage (monotonic forward).
    update public.contacts
       set advisor_last_contact_at = v_ts
     where id = v_lead_id
       and (advisor_last_contact_at is null or v_ts > advisor_last_contact_at);

    -- Human-owned stages: advisor outbound is the "último contacto".
    update public.contacts
       set last_seen = v_ts
     where id = v_lead_id
       and stage is not null
       and stage not in ('S1', 'S2', 'S3', 'S4', 'S5', 'descartado')
       and (last_seen is null or v_ts > last_seen);
  end if;

  return new;
exception when others then
  return new;
end;
$$;

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
    (select lmc.match_count::bigint from public.lead_match_counts lmc where lmc.lead_id = co.id) as match_count,
    co.advisor_last_contact_at
from public.contacts co
left join public.propiedades prop on prop.id = co.desarrollo_activo
group by co.id;

-- Backfill: seed advisor_last_contact_at from existing Baileys advisor-outbound.
update public.contacts co
   set advisor_last_contact_at = sub.last_adv
from (
  select ch.contact_id as id, max(to_timestamp(rm.ts::double precision)) as last_adv
  from wa_listener.raw_messages rm
  join wa_listener.chats ch
    on right(regexp_replace(ch.number, '\D', '', 'g'), 10) = right(regexp_replace(rm.number, '\D', '', 'g'), 10)
   and (ch.lid = rm.chat_id or ch.phone = rm.chat_id)
  where rm.from_advisor is true and coalesce(rm.text, '') <> '' and ch.contact_id is not null
  group by ch.contact_id
) sub
where co.id = sub.id;
