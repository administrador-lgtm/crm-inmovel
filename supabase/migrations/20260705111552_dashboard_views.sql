-- Inmovel operations dashboard aggregation views.

-- ① Pipeline: leads per stage (excl. descartado), split by advisor so the widget
-- can show the total per stage OR filter by advisor. RLS-scoped via contacts.
create or replace view public.dashboard_pipeline with (security_invoker = on) as
select
    (c.stage || '-' || coalesce(c.asesor_asignado::text, 'x')) as id,
    c.stage,
    c.asesor_asignado as asesor_id,
    count(*)::int as leads
from public.contacts c
where c.stage is not null and c.stage <> 'descartado'
group by c.stage, c.asesor_asignado;

-- ③ Follow-up: advisor-owned leads that need action — no advisor Baileys contact
-- (sin_contacto) or assigned-but-no-visit-yet (sin_visita). One row per lead.
create or replace view public.dashboard_followup with (security_invoker = on) as
select
    c.id,
    c.asesor_asignado as asesor_id,
    coalesce(c.nombre, c.first_name) as lead_name,
    c.stage,
    (c.stage in ('S6','S7','S8','S9','S10') and c.advisor_last_contact_at is null) as sin_contacto,
    (c.asesor_asignado is not null and c.stage in ('S5','S6')
        and not exists (select 1 from public.visitas v where v.lead_id = c.id)) as sin_visita
from public.contacts c
where c.stage <> 'descartado'
  and (
    (c.stage in ('S6','S7','S8','S9','S10') and c.advisor_last_contact_at is null)
    or (c.asesor_asignado is not null and c.stage in ('S5','S6')
        and not exists (select 1 from public.visitas v where v.lead_id = c.id))
  );

-- ⑤ Handoff-ready leads not yet claimed by an advisor (S4 ready / S5 sent, no
-- asesor). RLS makes this an admin/revops worklist (advisors can't see unassigned).
create or replace view public.dashboard_handoff_unassigned with (security_invoker = on) as
select
    c.id,
    coalesce(c.nombre, c.first_name) as lead_name,
    c.stage,
    c.zona_interes,
    c.presupuesto,
    c.telefono,
    c.stage_changed_at
from public.contacts c
where c.stage in ('S4','S5') and c.asesor_asignado is null;

grant select on public.dashboard_pipeline to anon, authenticated, service_role;
grant select on public.dashboard_followup to anon, authenticated, service_role;
grant select on public.dashboard_handoff_unassigned to anon, authenticated, service_role;
