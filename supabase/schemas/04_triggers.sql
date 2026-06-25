--
-- Triggers
-- This file declares all triggers.
--

-- Auto-populate sales_id from current auth user on insert
create or replace trigger set_contact_sales_id_trigger
    before insert on public.contacts
    for each row execute function public.set_sales_id_default();

create or replace trigger set_contact_notes_sales_id_trigger
    before insert on public.contact_notes
    for each row execute function public.set_sales_id_default();


-- Lowercase contact emails before insert or update (must run before contact_saved)
create or replace trigger "10_lowercase_contact_emails"
    before insert or update on public.contacts
    for each row execute function public.lowercase_email_jsonb();

-- Auto-fetch contact avatar from email on save (runs after lowercase_contact_emails)
create or replace trigger "20_contact_saved"
    before insert or update on public.contacts
    for each row execute function public.handle_contact_saved();

-- Update contact.last_seen when a contact note is created
create or replace trigger on_public_contact_notes_created_or_updated
    after insert on public.contact_notes
    for each row execute function public.handle_contact_note_created_or_updated();

-- Cleanup storage attachments when contact notes are updated or deleted
create or replace trigger on_contact_notes_attachments_updated_delete_note_attachments
    after update on public.contact_notes
    for each row
    when (old.attachments is distinct from new.attachments)
    execute function public.cleanup_note_attachments();

create or replace trigger on_contact_notes_deleted_delete_note_attachments
    after delete on public.contact_notes
    for each row execute function public.cleanup_note_attachments();

-- Auth triggers: sync auth.users to public.sales
create or replace trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

create or replace trigger on_auth_user_updated
    after update on auth.users
    for each row execute function public.handle_update_user();

-- Inmovel: enforce the stage-ownership frontier on contacts (S1..S5 are
-- sync-owned and cannot be set by CRM users). See enforce_stage_frontier().
create or replace trigger enforce_stage_frontier_trigger
    before update on public.contacts
    for each row execute function public.enforce_stage_frontier();

-- Stamp stage_changed_at on any real stage change (kanban "time in stage" timer).
create or replace trigger set_stage_changed_at_trigger
    before update on public.contacts
    for each row execute function public.set_stage_changed_at();

-- Inmovel: keep sales_id and asesor_asignado in lockstep (single id source of
-- truth for ownership + RLS visibility). Named zz_ so it runs last, after
-- set_sales_id_default has defaulted sales_id on insert.
create or replace trigger zz_sync_advisor_id_trigger
    before insert or update on public.contacts
    for each row execute function public.sync_advisor_id();

-- Inmovel: CRM-side stage derivation — a synced handoff alert promotes the lead
-- to S5 (the bot never pushes stage; the CRM reacts to the event).
create or replace trigger promote_stage_on_handoff_trigger
    after insert on public.conversaciones
    for each row execute function public.promote_stage_on_handoff();

-- Inmovel: derive the pre-handoff funnel stage (S1..S4) from the lead's fields
-- on every sync write. Runs before set_stage_changed_at so the timer stamps the
-- derived change. (Name sorts before enforce_/set_ so it fires first.)
create or replace trigger derive_lead_stage_trigger
    before insert or update on public.contacts
    for each row execute function public.derive_lead_stage();

-- Inmovel: a note's @mentions spawn per-recipient notifications.
create or replace trigger create_note_mentions_trigger
    after insert on public.contact_notes
    for each row execute function public.create_note_mentions();

-- Inmovel: a new @mention pings the recipient on WhatsApp (edge function).
create or replace trigger notify_mention_wa_trigger
    after insert on public.note_mentions
    for each row execute function public.notify_mention_wa();

-- Inmovel: a reactivated lead's reply becomes a note on their ficha.
create or replace trigger create_reactivation_note_trigger
    after insert on public.conversaciones
    for each row execute function public.create_reactivation_note();
