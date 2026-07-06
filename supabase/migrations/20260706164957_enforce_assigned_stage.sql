-- Assigned leads: S5 (handoff enviado) with no advisor contact, S6 (asesor aceptó)
-- once contacted. + one-time reconcile of existing rows.

-- Business invariant for ASSIGNED leads (two rules), enforced as the LAST
-- before-trigger so it sees the final asesor_asignado + advisor_last_contact_at:
--   * assigned, advisor has NOT contacted the lead (no Baileys)  -> S5 (Handoff enviado)
--   * assigned, advisor HAS contacted (advisor_last_contact_at)  -> S6 (Asesor aceptó)
-- Only reshapes the handoff range (S1..S6). S7+ (visita/negociación/cierre) is
-- further along and left untouched.
create or replace function public.enforce_assigned_min_stage()
returns trigger
language plpgsql
as $$
begin
  if new.asesor_asignado is not null
     and new.stage in ('S1', 'S2', 'S3', 'S4', 'S5', 'S6') then
    if new.advisor_last_contact_at is not null then
      if new.stage <> 'S6' then
        new.stage := 'S6';
        new.stage_changed_at := now();
      end if;
    else
      if new.stage <> 'S5' then
        new.stage := 'S5';
        new.stage_changed_at := now();
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists zzz_enforce_assigned_min_stage_trigger on public.contacts;
create trigger zzz_enforce_assigned_min_stage_trigger
  before insert or update on public.contacts
  for each row execute function public.enforce_assigned_min_stage();

update public.contacts set stage = case when advisor_last_contact_at is not null then 'S6' else 'S5' end
where asesor_asignado is not null and stage in ('S1','S2','S3','S4','S5','S6');
