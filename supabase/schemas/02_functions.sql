--
-- Functions
-- This file declares all PL/pgSQL functions in the public schema.
--

CREATE OR REPLACE FUNCTION "public"."cleanup_note_attachments"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
    DECLARE
      payload jsonb;
      request_headers jsonb;
      auth_header text;
    BEGIN
      request_headers := coalesce(
        nullif(current_setting('request.headers', true), '')::jsonb,
        '{}'::jsonb
      );
      auth_header := request_headers ->> 'authorization';

      IF auth_header IS NULL OR auth_header = '' THEN
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;

        RETURN NEW;
      END IF;

      payload := jsonb_build_object(
        'old_record', OLD,
        'record', NEW,
        'type', TG_OP
      );

      PERFORM net.http_post(
        url := public.get_note_attachments_function_url(),
        body := payload,
        params := '{}'::jsonb,
        headers := jsonb_build_object(
          'Content-Type',
          'application/json',
          'Authorization',
          auth_header
        ),
        timeout_milliseconds := 10000
      );

      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;

      RETURN NEW;
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."get_avatar_for_email"("email" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare email_hash text;
declare gravatar_url text;
declare gravatar_status int8;
declare email_domain text;
declare favicon_url text;
declare domain_status int8;

begin
    -- Try to fetch a gravatar image
    email_hash = encode(extensions.digest(email, 'sha256'), 'hex');
    gravatar_url = concat('https://www.gravatar.com/avatar/', email_hash, '?d=404');

    select status from extensions.http_get(gravatar_url) into gravatar_status;

    if gravatar_status = 200 then
        return gravatar_url;
    end if;

    -- Fallback to email's domain favicon if not excluded
    email_domain = split_part(email, '@', 2);
    return get_domain_favicon(email_domain);
exception
    when others then
        return 'ERROR';
end;
$$;

CREATE OR REPLACE FUNCTION "public"."get_domain_favicon"("domain_name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare domain_status int8;

begin
    if exists (select from favicons_excluded_domains as fav where fav.domain = domain_name) then
        return null;
    end if;

    return concat(
        'https://favicon.show/',
        (regexp_matches(domain_name, '^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)', 'i'))[1]
    );
end;
$$;

CREATE OR REPLACE FUNCTION "public"."get_note_attachments_function_url"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
    DECLARE
      issuer text;
      function_url text;
    BEGIN
      issuer := coalesce(
        nullif(current_setting('request.jwt.claim.iss', true), ''),
        (
          coalesce(
            nullif(current_setting('request.jwt.claims', true), ''),
            '{}'
          )::jsonb ->> 'iss'
        )
      );
      issuer := nullif(issuer, '');
      IF issuer IS NOT NULL THEN
        issuer := rtrim(issuer, '/');
        IF right(issuer, 8) = '/auth/v1' THEN
          function_url :=
            left(issuer, length(issuer) - 8) || '/functions/v1/delete_note_attachments';

          IF function_url LIKE 'http://127.0.0.1:%' THEN
            RETURN replace(
              function_url,
              'http://127.0.0.1:',
              'http://host.docker.internal:'
            );
          END IF;

          IF function_url LIKE 'http://localhost:%' THEN
            RETURN replace(
              function_url,
              'http://localhost:',
              'http://host.docker.internal:'
            );
          END IF;

          RETURN function_url;
        END IF;
      END IF;

      RETURN 'http://host.docker.internal:54321/functions/v1/delete_note_attachments';
    END;
    $$;

CREATE OR REPLACE FUNCTION "public"."get_user_id_by_email"("email" "text") RETURNS TABLE("id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
BEGIN
  RETURN QUERY SELECT au.id FROM auth.users au WHERE au.email = $1;
END;
$_$;

CREATE OR REPLACE FUNCTION "public"."handle_contact_note_created_or_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.contacts set last_seen = new.date where contacts.id = new.contact_id and contacts.last_seen < new.date;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_contact_saved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$declare contact_avatar text;
declare emails_length int8;
declare item jsonb;

begin
    if new.avatar is not null then
        return new;
    end if;

    select coalesce(jsonb_array_length(new.email_jsonb), 0) into emails_length;

    if emails_length = 0 then
        return new;
    end if;

    for item in select jsonb_array_elements(new.email_jsonb)
    loop
        select public.get_avatar_for_email(item->>'email') into contact_avatar;
        if (contact_avatar is not null) then
            exit;
        end if;
    end loop;

    if contact_avatar is null then
        return new;
    end if;

    new.avatar = concat('{"src":"', contact_avatar, '"}');
    return new;
end;$$;

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  sales_count int;
begin
  -- Inmovel: restrict sign-up to the company domain. Any other email (e.g. a
  -- Google OAuth account outside @inmovel.net) is rejected here, at the DB.
  if new.email is null or lower(new.email) not like '%@inmovel.net' then
    raise exception 'Only @inmovel.net accounts are allowed';
  end if;

  select count(id) into sales_count
  from public.sales;

  insert into public.sales (first_name, last_name, email, user_id, administrator)
  values (
    coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data -> 'custom_claims' ->> 'first_name', 'Pending'),
    coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data -> 'custom_claims' ->> 'last_name', 'Pending'),
    new.email,
    new.id,
    case when sales_count > 0 then FALSE else TRUE end
  );
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."handle_update_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  update public.sales
  set
    first_name = coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data -> 'custom_claims' ->> 'first_name', 'Pending'),
    last_name = coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data -> 'custom_claims' ->> 'last_name', 'Pending'),
    email = new.email
  where user_id = new.id;

  return new;
end;
$$;

CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return exists (
    select 1 from public.sales where user_id = auth.uid() and administrator = true
  );
end;
$$;

CREATE OR REPLACE FUNCTION "public"."merge_contacts"("loser_id" bigint, "winner_id" bigint) RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
  winner_contact contacts%ROWTYPE;
  loser_contact contacts%ROWTYPE;
  merged_emails jsonb;
  merged_phones jsonb;
  merged_tags bigint[];
  winner_emails jsonb;
  loser_emails jsonb;
  winner_phones jsonb;
  loser_phones jsonb;
  email_map jsonb;
  phone_map jsonb;
BEGIN
  -- Fetch both contacts
  SELECT * INTO winner_contact FROM contacts WHERE id = winner_id;
  SELECT * INTO loser_contact FROM contacts WHERE id = loser_id;

  IF winner_contact IS NULL OR loser_contact IS NULL THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  -- 1. Reassign contact notes from loser to winner
  UPDATE contact_notes SET contact_id = winner_id WHERE contact_id = loser_id;

  -- 3. Merge contact data

  -- Get email arrays
  winner_emails := COALESCE(winner_contact.email_jsonb, '[]'::jsonb);
  loser_emails := COALESCE(loser_contact.email_jsonb, '[]'::jsonb);

  -- Merge emails with deduplication by email address
  -- Build a map of email -> email object, then convert back to array
  email_map := '{}'::jsonb;

  -- Add winner emails to map
  IF jsonb_array_length(winner_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_emails)-1 LOOP
      email_map := email_map || jsonb_build_object(
        winner_emails->i->>'email',
        winner_emails->i
      );
    END LOOP;
  END IF;

  -- Add loser emails to map (won't overwrite existing keys)
  IF jsonb_array_length(loser_emails) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_emails)-1 LOOP
      IF NOT email_map ? (loser_emails->i->>'email') THEN
        email_map := email_map || jsonb_build_object(
          loser_emails->i->>'email',
          loser_emails->i
        );
      END IF;
    END LOOP;
  END IF;

  -- Convert map back to array
  merged_emails := (SELECT jsonb_agg(value) FROM jsonb_each(email_map));
  merged_emails := COALESCE(merged_emails, '[]'::jsonb);

  -- Get phone arrays
  winner_phones := COALESCE(winner_contact.phone_jsonb, '[]'::jsonb);
  loser_phones := COALESCE(loser_contact.phone_jsonb, '[]'::jsonb);

  -- Merge phones with deduplication by number
  phone_map := '{}'::jsonb;

  -- Add winner phones to map
  IF jsonb_array_length(winner_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(winner_phones)-1 LOOP
      phone_map := phone_map || jsonb_build_object(
        winner_phones->i->>'number',
        winner_phones->i
      );
    END LOOP;
  END IF;

  -- Add loser phones to map (won't overwrite existing keys)
  IF jsonb_array_length(loser_phones) > 0 THEN
    FOR i IN 0..jsonb_array_length(loser_phones)-1 LOOP
      IF NOT phone_map ? (loser_phones->i->>'number') THEN
        phone_map := phone_map || jsonb_build_object(
          loser_phones->i->>'number',
          loser_phones->i
        );
      END IF;
    END LOOP;
  END IF;

  -- Convert map back to array
  merged_phones := (SELECT jsonb_agg(value) FROM jsonb_each(phone_map));
  merged_phones := COALESCE(merged_phones, '[]'::jsonb);

  -- Merge tags (remove duplicates)
  merged_tags := ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(winner_contact.tags, ARRAY[]::bigint[]) ||
      COALESCE(loser_contact.tags, ARRAY[]::bigint[])
    )
  );

  -- 5. Update winner with merged data
  UPDATE contacts SET
    avatar = COALESCE(winner_contact.avatar, loser_contact.avatar),
    gender = COALESCE(winner_contact.gender, loser_contact.gender),
    first_name = COALESCE(winner_contact.first_name, loser_contact.first_name),
    last_name = COALESCE(winner_contact.last_name, loser_contact.last_name),
    title = COALESCE(winner_contact.title, loser_contact.title),
    email_jsonb = merged_emails,
    phone_jsonb = merged_phones,
    linkedin_url = COALESCE(winner_contact.linkedin_url, loser_contact.linkedin_url),
    background = COALESCE(winner_contact.background, loser_contact.background),
    has_newsletter = COALESCE(winner_contact.has_newsletter, loser_contact.has_newsletter),
    first_seen = LEAST(COALESCE(winner_contact.first_seen, loser_contact.first_seen), COALESCE(loser_contact.first_seen, winner_contact.first_seen)),
    last_seen = GREATEST(COALESCE(winner_contact.last_seen, loser_contact.last_seen), COALESCE(loser_contact.last_seen, winner_contact.last_seen)),
    sales_id = COALESCE(winner_contact.sales_id, loser_contact.sales_id),
    tags = merged_tags
  WHERE id = winner_id;

  -- 6. Delete loser contact
  DELETE FROM contacts WHERE id = loser_id;

  RETURN winner_id;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."lowercase_email_jsonb"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.email_jsonb IS NOT NULL THEN
    NEW.email_jsonb = COALESCE((
      SELECT jsonb_agg(
        jsonb_set(elem, '{email}', to_jsonb(LOWER(elem->>'email')))
      )
      FROM jsonb_array_elements(NEW.email_jsonb) AS elem
    ), '[]'::jsonb);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."set_sales_id_default"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.sales_id IS NULL THEN
    SELECT id INTO NEW.sales_id FROM sales WHERE user_id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Inmovel: the sales.id of the currently authenticated user (null if none).
CREATE OR REPLACE FUNCTION "public"."current_sale_id"() RETURNS bigint
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  return (select id from public.sales where user_id = auth.uid());
end;
$$;

-- Inmovel: whether the current user may access a lead assigned to `asesor`.
-- Admins see everything; everyone else sees their own leads plus the leads of
-- any advisor who reports to them (manager_id graph). A plain advisor with no
-- reports therefore sees only their own leads — no separate manager role needed.
CREATE OR REPLACE FUNCTION "public"."can_access_lead"("asesor" bigint) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  me bigint;
begin
  if public.is_admin() then
    return true;
  end if;
  me := public.current_sale_id();
  if me is null then
    return false;
  end if;
  return asesor = me
    or asesor in (select id from public.sales where manager_id = me);
end;
$$;

-- Inmovel: DB-level guard for the stage-ownership frontier. CRM users
-- (authenticated, non-service-role) may never set a lead's stage into the
-- sync-owned range S1..S5. The sync itself runs as service_role and bypasses
-- RLS/this guard. Complements the UI guard in StageControl.
CREATE OR REPLACE FUNCTION "public"."enforce_stage_frontier"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  -- auth.uid() is null for the service role (the sync); only police CRM users.
  if auth.uid() is not null
     and new.stage is distinct from old.stage
     and new.stage in ('S1', 'S2', 'S3', 'S4', 'S5') then
    raise exception 'Stage % is sync-owned and cannot be set from the CRM', new.stage;
  end if;
  return new;
end;
$$;

-- Stamp stage_changed_at whenever a lead's stage actually changes (ignores the
-- sync re-writing the same value). Drives the "time in stage" kanban timer.
CREATE OR REPLACE FUNCTION "public"."set_stage_changed_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.stage is distinct from old.stage then
    new.stage_changed_at = now();
  end if;
  return new;
end;
$$;

-- Inmovel: keep the two advisor-id columns in lockstep. `sales_id` is the
-- canonical owner (standard CRM field) and `asesor_asignado` is what the RLS
-- reads; this guarantees they can never diverge so a lead's owner is always its
-- visible advisor. Everything is keyed by id — the Sheet's advisor NAME is
-- resolved to an id once, in the sync. Whichever id column a writer changes,
-- the other follows (sales_id wins on insert / simultaneous change).
CREATE OR REPLACE FUNCTION "public"."sync_advisor_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'INSERT' then
    new.asesor_asignado := coalesce(new.sales_id, new.asesor_asignado);
    new.sales_id := coalesce(new.sales_id, new.asesor_asignado);
  else
    if new.sales_id is distinct from old.sales_id then
      new.asesor_asignado := new.sales_id;
    elsif new.asesor_asignado is distinct from old.asesor_asignado then
      new.sales_id := new.asesor_asignado;
    end if;
  end if;
  return new;
end;
$$;

-- Inmovel: the CRM derives the funnel stage from events (it does not let the bot
-- push stage). When a handoff alert ('alerta') lands in conversaciones, promote
-- the lead to S5 (handoff enviado) if it's still in an earlier funnel stage.
CREATE OR REPLACE FUNCTION "public"."promote_stage_on_handoff"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.rol = 'alerta' then
    update public.contacts
    set stage = 'S5'
    where id = new.lead_id
      and (stage is null or stage in ('S1', 'S2', 'S3', 'S4'));
  end if;
  return new;
end;
$$;

-- Inmovel: CRM derives the pre-handoff funnel stage (S1..S4) from the lead's own
-- fields, so the board reflects reality without the bot pushing stage. Only the
-- sync (service role; auth.uid() is null) derives, and only while the lead is
-- still pre-handoff — S5+ is owned by the handoff flow / advisor.
CREATE OR REPLACE FUNCTION "public"."derive_lead_stage"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if auth.uid() is not null then
    return new;
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

-- Inmovel: fan a note's @mentions out into per-recipient note_mentions rows
-- (skipping the author). SECURITY DEFINER so it can write past note_mentions RLS.
CREATE OR REPLACE FUNCTION "public"."create_note_mentions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare r bigint;
begin
  if new.mentions is not null then
    foreach r in array new.mentions loop
      if r is distinct from new.sales_id then
        insert into public.note_mentions(note_id, contact_id, recipient_id, sender_id)
        values (new.id, new.contact_id, r, new.sales_id);
      end if;
    end loop;
  end if;
  return new;
end;
$$;

-- Inmovel: on a new @mention, ping the recipient on WhatsApp via the
-- notify_mention edge function (pg_net). The shared secret lives in app_config
-- (not in this definition) so it is never committed.
CREATE OR REPLACE FUNCTION "public"."notify_mention_wa"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare secret text;
begin
  select value into secret from public.app_config where key = 'notify_secret';
  perform net.http_post(
    url := 'https://yvowokyomykvntupibpp.supabase.co/functions/v1/notify_mention',
    body := jsonb_build_object('mention_id', new.id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notify-secret', secret
    )
  );
  return new;
end;
$$;

-- Inmovel: when a reactivated lead (phone in public.reactivaciones) replies, the
-- bot only records it in conversaciones — advisors never see it. Surface that
-- reply as a note on the lead's ficha so it gets followed up. One note per lead
-- (idempotent); fires on each new inbound conversacion row.
CREATE OR REPLACE FUNCTION "public"."create_reactivation_note"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_tel text;
  v_grupo text;
  v_template text;
begin
  if new.rol is distinct from 'lead' then return new; end if;
  select right(regexp_replace(coalesce(c.telefono, c.sheet_id, ''), '\D', '', 'g'), 10)
    into v_tel from public.contacts c where c.id = new.lead_id;
  if v_tel is null or v_tel = '' then return new; end if;
  select grupo, template into v_grupo, v_template
    from public.reactivaciones where telefono = v_tel;
  if not found then return new; end if;
  if exists (select 1 from public.contact_notes n
             where n.contact_id = new.lead_id and n.text like '[Reactivación]%') then
    return new;
  end if;
  insert into public.contact_notes (contact_id, text, date, sales_id)
  values (
    new.lead_id,
    '[Reactivación] Template: ' || coalesce(v_template, v_grupo) ||
      ' | Respuesta: "' || coalesce(new.texto, '') || '"',
    coalesce(new."timestamp", now()),
    (select sales_id from public.contacts where id = new.lead_id)
  );
  return new;
end;
$$;
