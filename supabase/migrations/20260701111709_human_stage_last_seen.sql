-- Stage-aware "último contacto": human-owned stages (S6+) tie last_seen to the
-- last outbound advisor (Baileys) contact instead of freezing at the bot handoff.
-- Bot stages (S1..S5) stay owned by the bot sync. DB-only; no bot code change.

CREATE OR REPLACE FUNCTION public.sync_human_last_seen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_lead_id bigint;
  v_ts timestamptz;
begin
  -- Only advisor->lead messages with content ("we contacted them").
  if new.from_advisor is not true or coalesce(new.text, '') = '' then
    return new;
  end if;

  v_ts := to_timestamp(new.ts::double precision);

  -- Resolve the lead via the same number/chat mapping advisor_conversation uses.
  select co.id
    into v_lead_id
  from wa_listener.chats c
  join public.contacts co on co.id = c.contact_id
  where right(regexp_replace(c.number, '\D', '', 'g'), 10)
        = right(regexp_replace(new.number, '\D', '', 'g'), 10)
    and (c.lid = new.chat_id or c.phone = new.chat_id)
  limit 1;

  -- Human-owned stages only (S1..S5 belong to the bot). Only move forward in time.
  if v_lead_id is not null then
    update public.contacts
       set last_seen = v_ts
     where id = v_lead_id
       and stage is not null
       and stage not in ('S1', 'S2', 'S3', 'S4', 'S5', 'descartado')
       and (last_seen is null or v_ts > last_seen);
  end if;

  return new;
exception when others then
  return new;  -- never block the Baileys listener's insert on a bookkeeping error
end;
$function$


CREATE OR REPLACE FUNCTION public.protect_human_last_seen()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if old.stage is not null
     and old.stage not in ('S1', 'S2', 'S3', 'S4', 'S5', 'descartado')
     and new.last_seen is not null
     and old.last_seen is not null
     and new.last_seen < old.last_seen then
    new.last_seen := old.last_seen;
  end if;
  return new;
end;
$function$

-- Inmovel: advisor->lead Baileys outbound stamps last_seen for human stages (S6+).
drop trigger if exists sync_human_last_seen_trigger on wa_listener.raw_messages;
create trigger sync_human_last_seen_trigger
  after insert on wa_listener.raw_messages
  for each row execute function public.sync_human_last_seen();

-- Inmovel: keep human-stage last_seen monotonic so the Sheet sync can't pull it
-- back to the frozen bot-handoff value once Baileys has advanced it.
drop trigger if exists protect_human_last_seen_trigger on public.contacts;
create trigger protect_human_last_seen_trigger
  before update on public.contacts
  for each row execute function public.protect_human_last_seen();

-- One-time backfill: seed human-stage last_seen from the last OUTBOUND contact
-- (advisor Baileys, else bot), so it stops reflecting the frozen handoff moment.
update public.contacts co
   set last_seen = sub.new_last_seen
from (
  select c2.id,
    coalesce(
      (select max(to_timestamp(rm.ts::double precision))
         from wa_listener.raw_messages rm
         join wa_listener.chats ch
           on right(regexp_replace(ch.number,'\D','','g'),10) = right(regexp_replace(rm.number,'\D','','g'),10)
          and (ch.lid = rm.chat_id or ch.phone = rm.chat_id)
        where ch.contact_id = c2.id and rm.from_advisor is true and coalesce(rm.text,'') <> ''),
      (select max(cv.timestamp) from public.conversaciones cv where cv.lead_id = c2.id and cv.rol in ('bot','manual')),
      c2.stage_changed_at
    ) as new_last_seen
  from public.contacts c2
  where c2.stage is not null and c2.stage not in ('S1','S2','S3','S4','S5','descartado')
) sub
where co.id = sub.id and sub.new_last_seen is not null;
