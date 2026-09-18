-- Widen nocnok_raw for the demand engine.
--
-- The old 37-column shape was built for the advisor-facing Sheet. The demand bot
-- needs to SHOW properties to leads: photo URLs, the rebrandable shared ficha
-- (hides the original broker), development flags for the "visitas entregadas"
-- model, commission signal, etc. We keep targeted ingest (our zones/prices) but
-- capture a wide column set, plus a `raw` jsonb catch-all so no API field is ever
-- lost and new fields can be extracted without re-pulling. All additive + idempotent.

alter table public.nocnok_raw
  add column if not exists bathrooms numeric,
  add column if not exists category_text text,
  add column if not exists operacion_text text,
  add column if not exists price_text text,
  add column if not exists relevancia numeric,
  add column if not exists estatus text,
  add column if not exists estado_id text,
  add column if not exists colonia_id text,
  add column if not exists alcaldia_id text,
  add column if not exists street_name text,
  add column if not exists exterior_number text,
  add column if not exists ubicacion text,
  add column if not exists is_development boolean default false,
  add column if not exists is_presale boolean default false,
  add column if not exists is_in_network boolean default false,
  add column if not exists site_url text,
  add column if not exists marketplace_url text,
  add column if not exists shared_url text,
  add column if not exists pictures text[] default '{}',
  add column if not exists broker_certificacion text,
  add column if not exists account_is_in_network boolean default false,
  add column if not exists account_site_url text,
  add column if not exists account_picture_url text,
  add column if not exists raw jsonb;
