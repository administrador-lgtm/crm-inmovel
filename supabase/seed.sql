-- Inmovel: seed the singleton configuration row so the app's config loader
-- (getOne configuration?id=eq.1, single-object) never 406s on a fresh project.
insert into public.configuration (id, config)
values (1, '{"currency":"MXN","title":"Inmovel CRM"}'::jsonb)
on conflict (id) do nothing;
