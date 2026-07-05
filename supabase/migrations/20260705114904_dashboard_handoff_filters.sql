-- Handoff-unassigned widget: expose operation/property/entry-date for filtering + sort.

drop view if exists public.dashboard_handoff_unassigned;
create view public.dashboard_handoff_unassigned with (security_invoker = on) as
select
    c.id,
    coalesce(c.nombre, c.first_name) as lead_name,
    c.stage,
    c.tipo_busqueda as operacion,
    c.desarrollo_activo,
    c.zona_interes,
    c.presupuesto,
    c.telefono,
    c.first_seen,
    c.stage_changed_at
from public.contacts c
where c.stage in ('S4','S5') and c.asesor_asignado is null;
grant select on public.dashboard_handoff_unassigned to anon, authenticated, service_role;
