-- Auto-advance a lead to S7 (Visita solicitada) when a visit is scheduled.

-- Inmovel: scheduling a visit auto-advances the lead to S7 "Visita solicitada".
-- Forward-only: leaves S7+ (visita realizada / negociación / cierre) and
-- descartado untouched. Runs on visits created via agendar_visita OR mirrored
-- from Google Calendar by calendar_sync. SECURITY DEFINER so it can write the
-- contacts stage regardless of the inserting context.
create or replace function public.promote_stage_on_visit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.contacts
     set stage = 'S7'
   where id = new.lead_id
     and stage in ('S1', 'S2', 'S3', 'S4', 'S5', 'S6');
  return new;
end;
$$;

drop trigger if exists promote_stage_on_visit_trigger on public.visitas;
create trigger promote_stage_on_visit_trigger
  after insert on public.visitas
  for each row execute function public.promote_stage_on_visit();
