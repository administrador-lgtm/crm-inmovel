-- Notes must not move último contacto (last_seen). Drop the base atomic-crm
-- note->last_seen trigger; last_seen now reflects real contact only (bot / Baileys).
drop trigger if exists on_public_contact_notes_created_or_updated on public.contact_notes;
