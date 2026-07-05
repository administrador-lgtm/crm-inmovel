-- Schedule visits on ANY property (own or external "URL libre"). Drop the
-- propiedades FK; add a self-contained snapshot; visitas_agenda coalesces.

-- Allow scheduling visits on ANY property (own or external "URL libre"). The FK
-- to propiedades is dropped: external listings are volatile, so the visit keeps
-- a self-contained snapshot instead of a foreign key.
alter table public.visitas drop constraint if exists visitas_propiedad_id_fkey;
alter table public.visitas add column if not exists propiedad_fuente text default 'propia';
alter table public.visitas add column if not exists propiedad_nombre text;
alter table public.visitas add column if not exists propiedad_url text;
alter table public.visitas add column if not exists propiedad_url_maps text;

create or replace view public.visitas_agenda with (security_invoker = off) as
 select v.id,
    v.fecha,
    v.lead_id,
    coalesce(c.nombre, c.first_name) as lead_name,
    c.phone_jsonb as lead_phone,
    c.asesor_asignado as asesor_id,
    trim(both from (s.first_name || ' '::text) || coalesce(s.last_name, ''::text)) as asesor_name,
    v.propiedad_id,
    coalesce(p.nombre, v.propiedad_nombre) as propiedad_name,
    coalesce(p.url_maps, v.propiedad_url_maps) as url_maps,
    v.estado,
    c.stage,
    v.propiedad_url,
    v.propiedad_fuente
   from visitas v
     join contacts c on c.id = v.lead_id
     left join sales s on s.id = c.asesor_asignado
     left join propiedades p on p.id = v.propiedad_id;
