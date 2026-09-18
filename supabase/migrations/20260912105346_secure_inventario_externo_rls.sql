-- Secure the external inventory feeds (NocNok + Lamudi).
--
-- lamudi_raw was never put under RLS: with the Supabase default `grant all ... to
-- anon`, the public anon key could read all 3,067 Lamudi listings INCLUDING broker
-- contact data (broker_tel, broker_wa), directly and through the security_invoker
-- view inventario_externo. nocnok_raw was already protected (RLS on, authenticated
-- SELECT policy) but still carried the broad anon grant.
--
-- Fix: mirror nocnok_raw's RLS onto lamudi_raw, and revoke anon from both raw
-- tables and the two views. After this, the external inventory (with its broker
-- contacts) is reachable ONLY by service_role (the refresh writer) and
-- authenticated CRM users. Idempotent.

-- 1. RLS on lamudi_raw + authenticated-only SELECT policy (mirror nocnok_raw).
alter table public.lamudi_raw enable row level security;
drop policy if exists "Lamudi selectable by authenticated" on public.lamudi_raw;
create policy "Lamudi selectable by authenticated" on public.lamudi_raw
  for select to authenticated using (true);

-- 2. Defense in depth: remove anon's table/view privileges entirely. The CRM reads
--    as authenticated; the refresh writer uses service_role. anon has no business here.
revoke all on table public.nocnok_raw from anon;
revoke all on table public.lamudi_raw from anon;
revoke all on table public.inventario_externo from anon;
revoke all on table public.inventario_externo_colonias from anon;
