-- =====================================================================
-- Simulação mínima do ambiente Supabase para testes locais.
-- NÃO rodar no Supabase de verdade: lá tudo isso já existe.
-- =====================================================================

create extension if not exists pgcrypto;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

-- auth: usuários e auth.uid() lido do JWT, como no Supabase.
create schema auth;
create table auth.users (id uuid primary key, email text);

create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;

-- realtime: só o necessário para a migration 002.
create schema realtime;
create table realtime.messages (
  id bigserial primary key,
  topic text not null,
  event text,
  payload jsonb,
  private boolean
);
alter table realtime.messages enable row level security;

create function realtime.topic() returns text
language sql stable as $$
  select current_setting('realtime.topic', true)
$$;

create function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language sql as $$
  insert into realtime.messages (topic, event, payload, private)
  values (topic, event, payload, private);
$$;

grant usage on schema realtime to authenticated;
grant select on realtime.messages to authenticated;
grant execute on function realtime.topic() to authenticated;

-- Tabelas do site, com as colunas que o site usa hoje.
-- O tipo do id é trocado pelo script de teste (uuid e bigint).
create table public.eventos (
  id          __TIPO_ID__ primary key,
  nome        text not null,
  descricao   text,
  local       text,
  data_inicio date,
  data_fim    date,
  ativo       boolean default true,
  created_at  timestamptz default now()
);

create table public.perfis (
  id       uuid primary key references auth.users (id),
  nome     text,
  email    text,
  telefone text,
  cidade   text,
  is_admin boolean default false
);

-- Como no Supabase: o papel authenticated tem acesso às tabelas do
-- public por padrão. As regras de acesso é que restringem.
grant usage on schema public to anon, authenticated;
grant select on public.eventos, public.perfis to anon, authenticated;

-- Como no Supabase: tudo que for criado depois no public já nasce
-- liberado para anon e authenticated. A migration precisa fechar isso.
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
