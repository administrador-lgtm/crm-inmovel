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
create policy "Propiedades selectable by authenticated" on public.propiedades
  for select to authenticated using (true);

-- Visitas — advisor-owned. Visible/insertable when the parent lead is accessible.
create policy "Visitas selectable for accessible leads" on public.visitas
  for select to authenticated using (
    exists (
      select 1 from public.contacts c
      where c.id = visitas.lead_id and public.can_access_lead(c.asesor_asignado)
    )
  );
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
