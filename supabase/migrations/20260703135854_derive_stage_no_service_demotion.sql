-- Fix: sync/service writes could demote a CRM-owned lead (S6+) back to a Sheet
-- funnel stage (S6 -> S3, seen on lead 'Marconi'). derive_lead_stage only checked
-- NEW.stage, not the stored stage, so a stale sheet_sync payload.stage won over the
-- frontier. Now service writes may promote a CRM-owned stage but never demote it.

CREATE OR REPLACE FUNCTION "public"."derive_lead_stage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  -- CRM user writes (with a JWT) are authoritative — advisors may move stages freely.
  if auth.uid() is not null then
    return new;
  end if;

  -- Sync/service writes are the ONLY writers here. They must never move a
  -- CRM-owned stage backwards: once a lead is S6+ (advisor territory) or
  -- descartado, the sheet mirror can send a stale funnel stage, but the DB is
  -- the final frontier. Promotions (e.g. S6 -> S7 on a visit) are still allowed.
  if tg_op = 'UPDATE' and old.stage is not null then
    if old.stage = 'descartado' and new.stage is distinct from 'descartado' then
      new.stage := 'descartado';
      return new;
    end if;
    if old.stage ~ '^S[0-9]+$'
       and (regexp_replace(old.stage, '\D', '', 'g'))::int >= 6
       and new.stage ~ '^S[0-9]+$'
       and (regexp_replace(new.stage, '\D', '', 'g'))::int
           < (regexp_replace(old.stage, '\D', '', 'g'))::int then
      new.stage := old.stage;
      return new;
    end if;
  end if;

  if new.stage is not null and new.stage not in ('S1', 'S2', 'S3', 'S4') then
    return new;
  end if;
  if nullif(trim(new.zona_interes), '') is not null
     and nullif(trim(new.presupuesto), '') is not null then
    new.stage := 'S4';
  elsif nullif(trim(new.zona_interes), '') is not null
     or nullif(trim(new.presupuesto), '') is not null
     or nullif(trim(new.tipo_busqueda), '') is not null
     or nullif(trim(new.forma_compra), '') is not null then
    new.stage := 'S3';
  elsif coalesce(new.total_mensajes, 0) >= 3 then
    new.stage := 'S2';
  else
    new.stage := 'S1';
  end if;
  return new;
end;
$$;
