-- =====================================================================
-- App de Registro de Conversões — Missão Ide ao Sertão
-- Migration 001: tabelas, funções, gatilhos e regras de acesso (RLS)
--
-- Regras de segurança desta migration:
--   * Só CRIA objetos com prefixo app_. Nenhuma tabela do site
--     (eventos, perfis, inscricoes, certificados) é alterada.
--   * Do site, apenas LÊ public.eventos e public.perfis, sempre por
--     funções próprias, sem depender das regras de acesso do site.
--   * Roda inteira dentro de uma transação: se algo falhar, nada fica.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Papéis do app (quem é admin)
-- ---------------------------------------------------------------------
create table public.app_papeis (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  papel     text not null check (papel in ('admin')),
  criado_em timestamptz not null default now()
);

comment on table public.app_papeis is
  'Admins do app de conversões. Independente do is_admin do site.';

create function public.app_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_papeis
    where user_id = auth.uid()
      and papel = 'admin'
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Eventos do app (cada impacto), ligados ao evento do site
-- ---------------------------------------------------------------------
create table public.app_eventos (
  id         uuid primary key default gen_random_uuid(),
  status     text not null default 'planejado'
             check (status in ('planejado', 'ativo', 'encerrado')),
  criado_por uuid references auth.users (id) on delete set null default auth.uid(),
  criado_em  timestamptz not null default now()
);

comment on table public.app_eventos is
  'Um impacto no app. Nome, local e datas vêm de public.eventos (site).';

-- A coluna que liga ao evento do site é criada com o MESMO tipo de
-- public.eventos.id (uuid ou número), descoberto na hora da migration.
-- "on delete restrict": o site não consegue apagar um evento que já
-- tenha dados no app, protegendo as conversões registradas.
do $$
declare
  tipo_id text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into tipo_id
  from pg_attribute a
  where a.attrelid = 'public.eventos'::regclass
    and a.attname = 'id'
    and not a.attisdropped;

  if tipo_id is null then
    raise exception 'Coluna public.eventos.id não encontrada';
  end if;

  execute format(
    'alter table public.app_eventos
       add column evento_site_id %s not null unique
       references public.eventos (id) on delete restrict',
    tipo_id
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 3. Grupos de missionários e histórico de líderes
-- ---------------------------------------------------------------------
create table public.app_grupos (
  id        uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.app_eventos (id) on delete restrict,
  nome      text not null check (char_length(btrim(nome)) between 1 and 60),
  lider_id  uuid references auth.users (id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (evento_id, nome),
  unique (evento_id, lider_id)   -- um líder lidera no máximo um grupo por evento
);

create index app_grupos_lider_idx on public.app_grupos (lider_id);

-- Quem já liderou cada grupo. Serve para que um líder substituído no
-- meio do evento ainda consiga enviar os registros que ficaram
-- pendentes no celular dele enquanto o evento estiver ativo.
create table public.app_lideres_historico (
  grupo_id   uuid not null references public.app_grupos (id) on delete cascade,
  lider_id   uuid not null references auth.users (id) on delete cascade,
  desde      timestamptz not null default now(),
  primary key (grupo_id, lider_id)
);

create index app_lideres_historico_lider_idx on public.app_lideres_historico (lider_id);

create function public.app_registrar_lider_historico()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lider_id is not null
     and (tg_op = 'INSERT' or new.lider_id is distinct from old.lider_id) then
    insert into public.app_lideres_historico (grupo_id, lider_id)
    values (new.id, new.lider_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger app_grupos_historico_lider
after insert or update of lider_id on public.app_grupos
for each row execute function public.app_registrar_lider_historico();

-- O grupo não pode trocar de evento depois de criado.
create function public.app_grupos_travar_evento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.evento_id is distinct from old.evento_id then
    raise exception 'Um grupo não pode mudar de evento';
  end if;
  return new;
end;
$$;

create trigger app_grupos_travar_evento
before update on public.app_grupos
for each row execute function public.app_grupos_travar_evento();

-- Funções auxiliares das regras de acesso (security definer evita
-- recursão de RLS ao consultar app_grupos de dentro de app_grupos).
create function public.app_lidera_evento(p_evento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_grupos g
    join public.app_lideres_historico h on h.grupo_id = g.id
    where g.evento_id = p_evento_id
      and h.lider_id = auth.uid()
  );
$$;

create function public.app_pode_registrar(p_grupo_id uuid, p_evento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_grupos g
    join public.app_eventos e on e.id = g.evento_id
    join public.app_lideres_historico h on h.grupo_id = g.id
    where g.id = p_grupo_id
      and g.evento_id = p_evento_id
      and e.status = 'ativo'
      and h.lider_id = auth.uid()
  );
$$;

create function public.app_evento_ativo(p_evento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.app_eventos
    where id = p_evento_id and status = 'ativo'
  );
$$;

-- ---------------------------------------------------------------------
-- 4. Conversões
-- ---------------------------------------------------------------------
create table public.app_conversoes (
  id                   uuid primary key,  -- gerado no celular (envio idempotente)
  evento_id            uuid not null references public.app_eventos (id) on delete restrict,
  grupo_id             uuid not null references public.app_grupos (id) on delete restrict,
  registrado_por       uuid not null default auth.uid()
                       references auth.users (id) on delete restrict,
  nome                 text not null check (char_length(btrim(nome)) between 2 and 120),
  apelido              text check (char_length(apelido) <= 60),
  idade                smallint check (idade between 0 and 120),
  whatsapp             text check (whatsapp ~ '^[0-9]{10,13}$'),
  endereco             text not null check (char_length(btrim(endereco)) between 3 and 300),
  responsavel_nome     text check (char_length(responsavel_nome) <= 120),
  responsavel_telefone text check (responsavel_telefone ~ '^[0-9]{10,13}$'),
  consentimento        boolean not null check (consentimento),
  registrado_em        timestamptz not null,
  recebido_em          timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

comment on column public.app_conversoes.id is
  'Gerado no celular. Reenviar o mesmo registro não cria duplicata.';
comment on column public.app_conversoes.whatsapp is
  'Só dígitos: DDD + número (ex.: 87999998888).';

create index app_conversoes_evento_idx on public.app_conversoes (evento_id, grupo_id);
create index app_conversoes_autor_idx  on public.app_conversoes (registrado_por);

-- Validações e campos controlados pelo servidor.
create function public.app_conversoes_antes_gravar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento_do_grupo uuid;
begin
  select evento_id into v_evento_do_grupo
  from public.app_grupos where id = new.grupo_id;

  if v_evento_do_grupo is distinct from new.evento_id then
    raise exception 'O grupo informado não pertence a este evento';
  end if;

  -- Hora do celular não pode estar no futuro (relógio errado).
  new.registrado_em := least(new.registrado_em, now());
  new.atualizado_em := least(coalesce(new.atualizado_em, now()), now());

  -- Responsável só faz sentido para menores de 18 anos.
  if new.idade is null or new.idade >= 18 then
    new.responsavel_nome := null;
    new.responsavel_telefone := null;
  end if;

  if tg_op = 'INSERT' then
    -- Ninguém registra no nome de outra pessoa.
    if auth.uid() is not null then
      new.registrado_por := auth.uid();
    end if;
    new.recebido_em := now();
  else
    -- Campos que nunca mudam depois de recebidos.
    new.id             := old.id;
    new.registrado_por := old.registrado_por;
    new.registrado_em  := old.registrado_em;
    new.recebido_em    := old.recebido_em;

    -- Só o admin move um registro de evento ou de grupo.
    if not public.app_is_admin()
       and (new.evento_id is distinct from old.evento_id
            or new.grupo_id is distinct from old.grupo_id) then
      raise exception 'Só o admin pode mover um registro de grupo ou evento';
    end if;

    -- Correção feita offline: vale a versão mais recente.
    if new.atualizado_em < old.atualizado_em then
      return old;
    end if;
  end if;

  return new;
end;
$$;

create trigger app_conversoes_antes_gravar
before insert or update on public.app_conversoes
for each row execute function public.app_conversoes_antes_gravar();

-- ---------------------------------------------------------------------
-- 5. Registro de exportações (prestação de contas LGPD)
-- ---------------------------------------------------------------------
create table public.app_exportacoes (
  id            uuid primary key default gen_random_uuid(),
  evento_id     uuid not null references public.app_eventos (id) on delete restrict,
  exportado_por uuid not null default auth.uid() references auth.users (id) on delete restrict,
  formato       text not null check (formato in ('xlsx', 'csv', 'texto')),
  filtro        jsonb,
  quantidade    integer not null check (quantidade >= 0),
  exportado_em  timestamptz not null default now()
);

create function public.app_exportacoes_antes_gravar()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.exportado_por := auth.uid();
  end if;
  new.exportado_em := now();
  return new;
end;
$$;

create trigger app_exportacoes_antes_gravar
before insert on public.app_exportacoes
for each row execute function public.app_exportacoes_antes_gravar();

-- ---------------------------------------------------------------------
-- 6. Consultas para o app (sem expor dados pessoais a quem não deve)
-- ---------------------------------------------------------------------

-- Placar: só contagens, nenhum dado pessoal.
create function public.app_placar(p_evento_id uuid)
returns table (grupo_id uuid, grupo_nome text, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.nome, count(c.id)
  from public.app_grupos g
  left join public.app_conversoes c on c.grupo_id = g.id
  where g.evento_id = p_evento_id
    and (public.app_is_admin() or public.app_lidera_evento(p_evento_id))
  group by g.id, g.nome
  order by count(c.id) desc, g.nome;
$$;

-- Eventos em que o usuário logado é (ou foi) líder, com os dados do site.
create function public.app_meus_eventos()
returns table (
  evento_id   uuid,
  status      text,
  nome        text,
  local       text,
  data_inicio date,
  data_fim    date,
  grupo_id    uuid,
  grupo_nome  text,
  lider_atual boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, e.status, s.nome::text, s.local::text,
         s.data_inicio::date, s.data_fim::date,
         g.id, g.nome, g.lider_id = auth.uid()
  from public.app_lideres_historico h
  join public.app_grupos  g on g.id = h.grupo_id
  join public.app_eventos e on e.id = g.evento_id
  join public.eventos     s on s.id = e.evento_site_id
  where h.lider_id = auth.uid()
  order by s.data_inicio desc;
$$;

-- Admin: eventos do site, para escolher qual vira impacto no app.
create function public.app_eventos_site()
returns table (
  id          text,
  nome        text,
  local       text,
  data_inicio date,
  data_fim    date,
  ativo       boolean,
  app_evento_id uuid,
  app_status  text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.app_is_admin() then
    raise exception 'Acesso restrito aos admins do app';
  end if;

  return query
  select s.id::text, s.nome::text, s.local::text,
         s.data_inicio::date, s.data_fim::date, s.ativo::boolean,
         e.id, e.status
  from public.eventos s
  left join public.app_eventos e on e.evento_site_id = s.id
  order by s.data_inicio desc;
end;
$$;

-- Admin: pessoas cadastradas no site, para escalar como líder.
create function public.app_pessoas()
returns table (id uuid, nome text, email text, telefone text, cidade text, is_admin_app boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.app_is_admin() then
    raise exception 'Acesso restrito aos admins do app';
  end if;

  return query
  select p.id, p.nome::text, p.email::text, p.telefone::text, p.cidade::text,
         exists (select 1 from public.app_papeis a where a.user_id = p.id)
  from public.perfis p
  order by p.nome;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Permissões básicas: nada para visitante anônimo
-- ---------------------------------------------------------------------
revoke all on
  public.app_papeis, public.app_eventos, public.app_grupos,
  public.app_lideres_historico, public.app_conversoes, public.app_exportacoes
from anon, public;

grant select, insert, update, delete on public.app_papeis      to authenticated;
grant select, insert, update         on public.app_eventos     to authenticated;
grant select, insert, update, delete on public.app_grupos      to authenticated;
grant select                         on public.app_lideres_historico to authenticated;
grant select, insert, update, delete on public.app_conversoes  to authenticated;
grant select, insert                 on public.app_exportacoes to authenticated;

revoke execute on function
  public.app_is_admin(),
  public.app_lidera_evento(uuid),
  public.app_pode_registrar(uuid, uuid),
  public.app_evento_ativo(uuid),
  public.app_placar(uuid),
  public.app_meus_eventos(),
  public.app_eventos_site(),
  public.app_pessoas(),
  public.app_registrar_lider_historico(),
  public.app_grupos_travar_evento(),
  public.app_conversoes_antes_gravar(),
  public.app_exportacoes_antes_gravar()
from anon, public;

grant execute on function
  public.app_is_admin(),
  public.app_lidera_evento(uuid),
  public.app_pode_registrar(uuid, uuid),
  public.app_evento_ativo(uuid),
  public.app_placar(uuid),
  public.app_meus_eventos(),
  public.app_eventos_site(),
  public.app_pessoas()
to authenticated;

-- ---------------------------------------------------------------------
-- 8. Regras de acesso (RLS)
-- ---------------------------------------------------------------------
alter table public.app_papeis            enable row level security;
alter table public.app_eventos           enable row level security;
alter table public.app_grupos            enable row level security;
alter table public.app_lideres_historico enable row level security;
alter table public.app_conversoes        enable row level security;
alter table public.app_exportacoes       enable row level security;

-- app_papeis: cada um vê o próprio papel; só admin gerencia.
create policy "papeis: ver o proprio ou admin" on public.app_papeis
  for select to authenticated
  using (user_id = auth.uid() or public.app_is_admin());
create policy "papeis: admin cria" on public.app_papeis
  for insert to authenticated with check (public.app_is_admin());
create policy "papeis: admin edita" on public.app_papeis
  for update to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy "papeis: admin remove" on public.app_papeis
  for delete to authenticated using (public.app_is_admin());

-- app_eventos: admin tudo (exceto apagar); líder vê os seus.
create policy "eventos: admin ou lider do evento ve" on public.app_eventos
  for select to authenticated
  using (public.app_is_admin() or public.app_lidera_evento(id));
create policy "eventos: admin cria" on public.app_eventos
  for insert to authenticated with check (public.app_is_admin());
create policy "eventos: admin edita" on public.app_eventos
  for update to authenticated using (public.app_is_admin()) with check (public.app_is_admin());

-- app_grupos: admin tudo; líder vê os grupos dos eventos em que lidera.
create policy "grupos: admin ou lider do evento ve" on public.app_grupos
  for select to authenticated
  using (public.app_is_admin() or public.app_lidera_evento(evento_id));
create policy "grupos: admin cria" on public.app_grupos
  for insert to authenticated with check (public.app_is_admin());
create policy "grupos: admin edita" on public.app_grupos
  for update to authenticated using (public.app_is_admin()) with check (public.app_is_admin());
create policy "grupos: admin remove" on public.app_grupos
  for delete to authenticated using (public.app_is_admin());

-- app_lideres_historico: só leitura, admin ou a própria linha.
create policy "historico: admin ou proprio" on public.app_lideres_historico
  for select to authenticated
  using (public.app_is_admin() or lider_id = auth.uid());

-- app_conversoes
create policy "conversoes: admin ve tudo, lider ve as proprias" on public.app_conversoes
  for select to authenticated
  using (public.app_is_admin() or registrado_por = auth.uid());
create policy "conversoes: lider do grupo com evento ativo, ou admin, cria" on public.app_conversoes
  for insert to authenticated
  with check (
    public.app_is_admin()
    or (registrado_por = auth.uid() and public.app_pode_registrar(grupo_id, evento_id))
  );
create policy "conversoes: autor com evento ativo, ou admin, edita" on public.app_conversoes
  for update to authenticated
  using (
    public.app_is_admin()
    or (registrado_por = auth.uid() and public.app_evento_ativo(evento_id))
  )
  with check (
    public.app_is_admin()
    or (registrado_por = auth.uid() and public.app_evento_ativo(evento_id))
  );
create policy "conversoes: admin apaga" on public.app_conversoes
  for delete to authenticated using (public.app_is_admin());

-- app_exportacoes: só admin registra e consulta; ninguém edita.
create policy "exportacoes: admin ve" on public.app_exportacoes
  for select to authenticated using (public.app_is_admin());
create policy "exportacoes: admin registra" on public.app_exportacoes
  for insert to authenticated with check (public.app_is_admin());

commit;
