--
-- Row Level Security
-- This file declares RLS policies for all tables.
--

-- Enable RLS on all tables
alter table public.contacts enable row level security;
alter table public.contact_notes enable row level security;
alter table public.sales enable row level security;
alter table public.propiedades enable row level security;
alter table public.visitas enable row level security;
alter table public.lead_propiedad enable row level security;
alter table public.conversaciones enable row level security;
alter table public.anuncios enable row level security;
alter table public.nocnok_raw enable row level security;
alter table public.lead_match_profile enable row level security;
alter table public.configuration enable row level security;
alter table public.favicons_excluded_domains enable row level security;

-- Contacts (leads) — per-advisor isolation. Admins see all; advisors see their
-- own leads plus the leads of advisors who report to them (manager_id graph).
create policy "Leads selectable by owner or manager or admin" on public.contacts
  for select to authenticated using (public.can_access_lead(asesor_asignado));
create policy "Leads insertable by accessible scope" on public.contacts
  for insert to authenticated with check (public.can_access_lead(asesor_asignado));
create policy "Leads updatable by accessible scope" on public.contacts
  for update to authenticated using (public.can_access_lead(asesor_asignado))
  with check (public.can_access_lead(asesor_asignado));
create policy "Leads deletable by admin only" on public.contacts
  for delete to authenticated using (public.is_admin());

-- Contact Notes
create policy "Enable read access for authenticated users" on public.contact_notes for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.contact_notes for insert to authenticated with check (true);
create policy "Contact Notes Update policy" on public.contact_notes for update to authenticated using (true);
create policy "Contact Notes Delete Policy" on public.contact_notes for delete to authenticated using (true);

-- Sales
create policy "Enable read access for authenticated users" on public.sales for select to authenticated using (true);

-- Tags

-- Propiedades — shared inventory, readable by all authenticated users.
-- Writes are limited to CRM-owned rows (crm_owned = true): Sheet-origin rows
-- stay read-only in the CRM until the bot flips off the Sheet. The sheet_sync
-- edge function runs as service_role and bypasses RLS.
-- See adr/ADR-propiedades-crm-owned-guard.md
create policy "Propiedades selectable by authenticated" on public.propiedades
  for select to authenticated using (true);
create policy "Propiedades insertable when crm owned" on public.propiedades
  for insert to authenticated with check (crm_owned = true);
create policy "Propiedades updatable when crm owned" on public.propiedades
  for update to authenticated using (crm_owned = true);

-- Visitas — advisor-owned writes, team-wide reads. SELECT is intentionally
-- loosened to any authenticated user so the Visits Agenda screen shows the whole
-- team's visits regardless of lead ownership. INSERT/UPDATE stay
-- can_access_lead-gated below so writes remain advisor-scoped.
-- See adr/ADR-TASK-001-visitas-team-wide-select.md
create policy "Visitas selectable by authenticated" on public.visitas
  for select to authenticated using (true);
create policy "Visitas insertable for accessible leads" on public.visitas
  for insert to authenticated with check (
    exists (
      select 1 from public.contacts c
      where c.id = visitas.lead_id and public.can_access_lead(c.asesor_asignado)
    )
  );
create policy "Visitas updatable for accessible leads" on public.visitas
  for update to authenticated using (
    exists (
      select 1 from public.contacts c
      where c.id = visitas.lead_id and public.can_access_lead(c.asesor_asignado)
    )
  );

-- Lead<->property relations — visible when the parent lead is accessible.
create policy "Lead_propiedad selectable for accessible leads" on public.lead_propiedad
  for select to authenticated using (
    exists (
      select 1 from public.contacts c
      where c.id = lead_propiedad.lead_id and public.can_access_lead(c.asesor_asignado)
    )
  );

-- Conversaciones — bot transcript, read-only, scoped to accessible leads.
create policy "Conversaciones selectable for accessible leads" on public.conversaciones
  for select to authenticated using (
    exists (
      select 1 from public.contacts c
      where c.id = conversaciones.lead_id and public.can_access_lead(c.asesor_asignado)
    )
  );

-- Lead match profile — bot-extracted per-lead search intent (budget/zona),
-- read-only, scoped to accessible leads. This policy IS the security boundary
-- for the lead_property_matches view: that view is security_invoker = on, so a
-- caller's read of it re-applies this policy and only ever returns matches for
-- leads the caller owns. Same shape as conversaciones above.
create policy "Lead match profile selectable for accessible leads" on public.lead_match_profile
  for select to authenticated using (
    exists (
      select 1 from public.contacts c
      where c.id = lead_match_profile.lead_id and public.can_access_lead(c.asesor_asignado)
    )
  );

-- Anuncios and NocNok raw — reference data, readable by all authenticated users.
create policy "Anuncios selectable by authenticated" on public.anuncios
  for select to authenticated using (true);
create policy "Nocnok selectable by authenticated" on public.nocnok_raw
  for select to authenticated using (true);

-- Configuration (admin-only for writes)
create policy "Configuration readable by all" on public.configuration for select using (true);
create policy "Enable insert for admins" on public.configuration for insert to authenticated with check (public.is_admin());
create policy "Enable update for admins" on public.configuration for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Favicons excluded domains
create policy "Enable access for authenticated users only" on public.favicons_excluded_domains to authenticated using (true) with check (true);

-- Note mentions — visible to the recipient, the sender, or admins; only the
-- recipient marks their own as read.
alter table public.note_mentions enable row level security;
create policy "Mentions visible to recipient sender or admin" on public.note_mentions
  for select to authenticated using (
    recipient_id = public.current_sale_id() or sender_id = public.current_sale_id() or public.is_admin());
create policy "Recipient marks own mention read" on public.note_mentions
  for update to authenticated using (recipient_id = public.current_sale_id())
  with check (recipient_id = public.current_sale_id());

-- App config — RLS on with no policies: only SECURITY DEFINER functions / the
-- service role can read it (holds the notify_mention shared secret).
alter table public.app_config enable row level security;

-- Reactivaciones — RLS on with no policies: only the SECURITY DEFINER
-- create_reactivation_note trigger / the service role reads it. The CRM never
-- queries it directly.
alter table public.reactivaciones enable row level security;
