-- Dashboard: active conversations vs assigned leads, per advisor.

-- Per-advisor: assigned leads (S6+) vs how many have an ACTIVE conversation.
-- Active (v1) = >=3 advisor messages AND >=3 lead messages in the last 7 days on
-- the Baileys thread (wa_listener). SECURITY DEFINER: it reads wa_listener, which
-- authenticated users can't; it's an admin/revops overview for now.
create or replace view public.dashboard_conversaciones_activas with (security_invoker = off) as
with adv_leads as (
    select c.id as lead_id, c.asesor_asignado as asesor_id
    from public.contacts c
    where c.stage in ('S6','S7','S8','S9','S10') and c.asesor_asignado is not null
),
msg_counts as (
    select ch.contact_id as lead_id,
        count(*) filter (where rm.from_advisor is true) as adv_msgs,
        count(*) filter (where rm.from_advisor is false) as lead_msgs
    from wa_listener.raw_messages rm
    join wa_listener.chats ch
        on right(regexp_replace(ch.number, '\D', '', 'g'), 10) = right(regexp_replace(rm.number, '\D', '', 'g'), 10)
       and (ch.lid = rm.chat_id or ch.phone = rm.chat_id)
    where rm.ts >= extract(epoch from (now() - interval '7 days'))
      and coalesce(rm.text, '') <> ''
    group by ch.contact_id
)
select
    al.asesor_id as id,
    al.asesor_id,
    trim(s.first_name || ' ' || coalesce(s.last_name, '')) as asesor_name,
    count(*)::int as leads_asignados,
    count(*) filter (where mc.adv_msgs >= 3 and mc.lead_msgs >= 3)::int as activas
from adv_leads al
left join msg_counts mc on mc.lead_id = al.lead_id
left join public.sales s on s.id = al.asesor_id
group by al.asesor_id, s.first_name, s.last_name;
grant select on public.dashboard_conversaciones_activas to anon, authenticated, service_role;
