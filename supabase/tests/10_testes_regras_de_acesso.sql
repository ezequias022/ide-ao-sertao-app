-- =====================================================================
-- Testes das regras de acesso do app de conversões.
-- Contas: admin, líder do grupo 1, líder do grupo 2, líder substituto
-- e uma conta sem função. Cada teste imprime PASS; uma falha interrompe.
-- =====================================================================
\set ON_ERROR_STOP on
\set QUIET on

\set admin   '''a0000000-0000-0000-0000-000000000001'''
\set lider1  '''b0000000-0000-0000-0000-000000000001'''
\set lider2  '''b0000000-0000-0000-0000-000000000002'''
\set lider3  '''b0000000-0000-0000-0000-000000000003'''
\set semfunc '''c0000000-0000-0000-0000-000000000001'''

-- ---------------------------------------------------------------------
-- Ferramentas de teste
-- ---------------------------------------------------------------------
create schema tests;

create function tests.como(p_user uuid) returns void language sql as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_user, 'role', 'authenticated')::text,
                    false);
$$;

create function tests.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond then raise notice 'PASS  %', msg;
  else raise exception 'FAIL  %', msg;
  end if;
end $$;

create function tests.bloqueado(sql text, msg text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'PASS  % [%]', msg, sqlerrm;
    return;
  end;
  raise exception 'FAIL  deveria ter sido bloqueado: %', msg;
end $$;

create function tests.linhas(sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute sql;
  get diagnostics n = row_count;
  return n;
end $$;

grant usage on schema tests to authenticated, anon;
grant execute on all functions in schema tests to authenticated, anon;

-- ---------------------------------------------------------------------
-- Dados iniciais (como superusuário, igual ao SQL Editor do Supabase)
-- ---------------------------------------------------------------------
insert into auth.users (id, email) values
  (:admin, 'admin@teste'), (:lider1, 'lider1@teste'), (:lider2, 'lider2@teste'),
  (:lider3, 'lider3@teste'), (:semfunc, 'semfuncao@teste');

insert into public.perfis (id, nome, email) values
  (:admin, 'Admin Teste', 'admin@teste'),
  (:lider1, 'Lider Um', 'lider1@teste'),
  (:lider2, 'Lider Dois', 'lider2@teste'),
  (:lider3, 'Lider Tres', 'lider3@teste'),
  (:semfunc, 'Sem Funcao', 'semfuncao@teste');

insert into public.eventos (id, nome, local, data_inicio, data_fim, ativo) values
  (__ID1__, 'Impacto Teste', 'Cidade A - PI', '2026-12-01', '2026-12-07', true),
  (__ID2__, 'Impacto Antigo', 'Cidade B - BA', '2026-01-10', '2026-01-15', false),
  (__ID3__, 'Impacto Sem Uso', 'Cidade C - BA', '2027-01-10', '2027-01-15', true);

-- Primeiro admin: cadastrado direto no SQL Editor (único passo manual).
insert into public.app_papeis (user_id, papel) values (:admin, 'admin');

-- ---------------------------------------------------------------------
-- 1. Visitante anônimo não acessa nada
-- ---------------------------------------------------------------------
select set_config('request.jwt.claims', '', false);
set role anon;
select tests.bloqueado('select * from public.app_conversoes', 'anônimo não lê conversões');
select tests.bloqueado('select * from public.app_placar(gen_random_uuid())', 'anônimo não chama o placar');
select tests.bloqueado('select public.app_is_admin()', 'anônimo não chama funções do app');
reset role;

-- ---------------------------------------------------------------------
-- 2. Admin monta o evento e os grupos
-- ---------------------------------------------------------------------
select tests.como(:admin);
set role authenticated;

select tests.ok(public.app_is_admin(), 'admin é reconhecido como admin');
select tests.ok((select count(*) from public.app_eventos_site()) = 3, 'admin lista os eventos do site');
select tests.ok((select count(*) from public.app_pessoas()) = 5, 'admin lista as pessoas cadastradas');

insert into public.app_eventos (evento_site_id, status)
  values (__ID1__, 'ativo'), (__ID2__, 'ativo');

select tests.bloqueado(
  $$insert into public.app_eventos (evento_site_id) values (__ID1__)$$,
  'o mesmo evento do site não vira dois impactos');

insert into public.app_grupos (evento_id, nome, lider_id)
select id, 'Grupo 1', :lider1::uuid from public.app_eventos where evento_site_id = __ID1__;
insert into public.app_grupos (evento_id, nome, lider_id)
select id, 'Grupo 2', :lider2::uuid from public.app_eventos where evento_site_id = __ID1__;
insert into public.app_grupos (evento_id, nome, lider_id)
select id, 'Grupo A', :lider1::uuid from public.app_eventos where evento_site_id = __ID2__;

select tests.bloqueado(
  format($$insert into public.app_grupos (evento_id, nome, lider_id) values (%L, 'Grupo 3', %L)$$,
         (select id from public.app_eventos where evento_site_id = __ID1__), :lider1),
  'um líder não lidera dois grupos no mesmo evento');

-- Evento antigo encerrado
update public.app_eventos set status = 'encerrado' where evento_site_id = __ID2__;

reset role;

-- Atalhos para os ids gerados
create table tests.ids as
select
  (select id from public.app_eventos where evento_site_id = __ID1__) as ev,
  (select id from public.app_eventos where evento_site_id = __ID2__) as ev_antigo,
  (select g.id from public.app_grupos g join public.app_eventos e on e.id = g.evento_id
     where e.evento_site_id = __ID1__ and g.nome = 'Grupo 1') as g1,
  (select g.id from public.app_grupos g join public.app_eventos e on e.id = g.evento_id
     where e.evento_site_id = __ID1__ and g.nome = 'Grupo 2') as g2,
  (select g.id from public.app_grupos g join public.app_eventos e on e.id = g.evento_id
     where e.evento_site_id = __ID2__) as g_antigo;
grant select on tests.ids to authenticated;

select ev, ev_antigo, g1, g2, g_antigo from tests.ids \gset

-- ---------------------------------------------------------------------
-- 3. Conta sem função não faz nada
-- ---------------------------------------------------------------------
select tests.como(:semfunc);
set role authenticated;

select tests.ok(not public.app_is_admin(), 'conta sem função não é admin');
select tests.ok((select count(*) from public.app_eventos) = 0, 'conta sem função não vê eventos');
select tests.ok((select count(*) from public.app_placar(:'ev')) = 0, 'conta sem função não vê o placar');
select tests.bloqueado('select * from public.app_pessoas()', 'conta sem função não lista pessoas');
select tests.bloqueado(
  format($$insert into public.app_conversoes (id, evento_id, grupo_id, nome, endereco, consentimento, registrado_em)
           values (gen_random_uuid(), %L, %L, 'Fulano', 'Rua X', true, now())$$, :'ev', :'g1'),
  'conta sem função não registra conversão');
select tests.bloqueado($$insert into public.app_papeis (user_id, papel) values (auth.uid(), 'admin')$$,
  'ninguém se promove a admin sozinho');

reset role;

-- ---------------------------------------------------------------------
-- 4. Líder registra no próprio grupo
-- ---------------------------------------------------------------------
select tests.como(:lider1);
set role authenticated;

select tests.ok(not public.app_is_admin(), 'líder não é admin');
select tests.ok((select count(*) from public.app_meus_eventos()) = 2, 'líder vê os eventos em que foi escalado');
select tests.ok((select count(*) from public.app_eventos) = 2, 'líder vê só os próprios eventos');

insert into public.app_conversoes
  (id, evento_id, grupo_id, nome, apelido, idade, whatsapp, endereco, consentimento, registrado_em)
values
  ('d0000000-0000-0000-0000-000000000001', :'ev', :'g1', 'José da Silva', 'Zé do Bode', 34,
   '87999998888', 'Rua da Igreja, 10, perto do mercado', true, now() - interval '1 hour');

-- Mesmo registro enviado de novo (confirmação perdida): não duplica.
select tests.bloqueado(
  format($$insert into public.app_conversoes (id, evento_id, grupo_id, nome, endereco, consentimento, registrado_em)
           values ('d0000000-0000-0000-0000-000000000001', %L, %L, 'José da Silva', 'Rua X', true, now())$$,
         :'ev', :'g1'),
  'reenvio do mesmo id não cria duplicata');

-- Menor de idade com responsável
insert into public.app_conversoes
  (id, evento_id, grupo_id, nome, idade, endereco, responsavel_nome, responsavel_telefone, consentimento, registrado_em)
values
  ('d0000000-0000-0000-0000-000000000002', :'ev', :'g1', 'Maria Souza', 12,
   'Sítio Boa Vista', 'Ana Souza', '87988887777', true, now());

-- Adulto: campos de responsável são descartados pelo servidor
insert into public.app_conversoes
  (id, evento_id, grupo_id, nome, idade, endereco, responsavel_nome, consentimento, registrado_em)
values
  ('d0000000-0000-0000-0000-000000000003', :'ev', :'g1', 'Pedro Lima', 40,
   'Rua Nova, 5', 'Não deveria ficar', true, now());

select tests.ok(
  (select responsavel_nome from public.app_conversoes where id = 'd0000000-0000-0000-0000-000000000002') = 'Ana Souza',
  'menor de idade guarda o responsável');
select tests.ok(
  (select responsavel_nome is null from public.app_conversoes where id = 'd0000000-0000-0000-0000-000000000003'),
  'adulto não guarda responsável');

-- Registro com relógio do celular adiantado
insert into public.app_conversoes (id, evento_id, grupo_id, nome, endereco, consentimento, registrado_em)
values ('d0000000-0000-0000-0000-000000000004', :'ev', :'g1', 'Relógio Errado', 'Rua Y', true,
        now() + interval '3 days');
select tests.ok(
  (select registrado_em <= now() from public.app_conversoes where id = 'd0000000-0000-0000-0000-000000000004'),
  'hora no futuro é corrigida para agora');

-- Bloqueios
select tests.bloqueado(
  format($$insert into public.app_conversoes (id, evento_id, grupo_id, nome, endereco, consentimento, registrado_em)
           values (gen_random_uuid(), %L, %L, 'Fulano', 'Rua X', true, now())$$, :'ev', :'g2'),
  'líder não registra no grupo de outro líder');
select tests.bloqueado(
  format($$insert into public.app_conversoes (id, evento_id, grupo_id, nome, endereco, consentimento, registrado_em)
           values (gen_random_uuid(), %L, %L, 'Fulano', 'Rua X', true, now())$$, :'ev_antigo', :'g_antigo'),
  'líder não registra em evento encerrado');
select tests.bloqueado(
  format($$insert into public.app_conversoes (id, evento_id, grupo_id, nome, endereco, consentimento, registrado_em)
           values (gen_random_uuid(), %L, %L, 'Fulano', 'Rua X', false, now())$$, :'ev', :'g1'),
  'sem consentimento não salva');
select tests.bloqueado(
  format($$insert into public.app_conversoes (id, evento_id, grupo_id, nome, endereco, consentimento, registrado_em)
           values (gen_random_uuid(), %L, %L, 'Fulano', '', true, now())$$, :'ev', :'g1'),
  'endereço vazio não salva');
select tests.bloqueado(
  format($$insert into public.app_conversoes (id, evento_id, grupo_id, nome, whatsapp, endereco, consentimento, registrado_em)
           values (gen_random_uuid(), %L, %L, 'Fulano', '(87) 9999-8888', 'Rua X', true, now())$$, :'ev', :'g1'),
  'WhatsApp fora do padrão (só dígitos) não salva');
select tests.bloqueado(
  format($$insert into public.app_conversoes (id, evento_id, grupo_id, nome, endereco, consentimento, registrado_em)
           values (gen_random_uuid(), %L, %L, 'Fulano', 'Rua X', true, now())$$, :'ev', :'g_antigo'),
  'grupo de outro evento é recusado');

-- Tentativa de registrar no nome de outra pessoa: o servidor força o autor
insert into public.app_conversoes (id, evento_id, grupo_id, registrado_por, nome, endereco, consentimento, registrado_em)
values ('d0000000-0000-0000-0000-000000000005', :'ev', :'g1', :lider2, 'Autor Falso', 'Rua Z', true, now());
select tests.ok(
  (select registrado_por = auth.uid() from public.app_conversoes where id = 'd0000000-0000-0000-0000-000000000005'),
  'o autor gravado é sempre quem está logado');

-- Correções
select tests.ok(
  tests.linhas($$update public.app_conversoes set apelido = 'Zé', atualizado_em = now()
                where id = 'd0000000-0000-0000-0000-000000000001'$$) = 1,
  'líder corrige o próprio registro');
select tests.bloqueado(
  format($$update public.app_conversoes set grupo_id = %L where id = 'd0000000-0000-0000-0000-000000000001'$$, :'g2'),
  'líder não move registro para outro grupo');

-- Correção antiga chegando depois de uma mais nova: a mais nova vale
update public.app_conversoes set apelido = 'Versão velha', atualizado_em = now() - interval '2 hours'
where id = 'd0000000-0000-0000-0000-000000000001';
select tests.ok(
  (select apelido from public.app_conversoes where id = 'd0000000-0000-0000-0000-000000000001') = 'Zé',
  'correção mais antiga não sobrescreve a mais nova');

select tests.ok(
  tests.linhas('delete from public.app_conversoes') = 0,
  'líder não apaga registros');
select tests.ok((select count(*) from public.app_conversoes) = 5, 'líder vê os 5 registros dele');

reset role;

-- ---------------------------------------------------------------------
-- 5. Outro líder: não vê dados pessoais alheios, mas vê o placar
-- ---------------------------------------------------------------------
select tests.como(:lider2);
set role authenticated;

select tests.ok((select count(*) from public.app_conversoes) = 0, 'líder 2 não vê registros do líder 1');
select tests.ok(
  tests.linhas($$update public.app_conversoes set nome = 'Hack'$$) = 0,
  'líder 2 não altera registros do líder 1');
select tests.ok(
  (select total from public.app_placar(:'ev') where grupo_nome = 'Grupo 1') = 5,
  'placar mostra 5 no Grupo 1 para o líder 2');
select tests.ok(
  (select total from public.app_placar(:'ev') where grupo_nome = 'Grupo 2') = 0,
  'placar mostra 0 no Grupo 2');
select tests.ok(
  (select count(*) from public.app_placar(:'ev_antigo')) = 0,
  'líder 2 não vê o placar de evento em que não está');
select tests.ok((select count(*) from public.app_exportacoes) = 0, 'líder não vê exportações');
select tests.bloqueado(
  format($$insert into public.app_exportacoes (evento_id, formato, quantidade) values (%L, 'csv', 1)$$, :'ev'),
  'líder não exporta');

reset role;

-- ---------------------------------------------------------------------
-- 6. Troca de líder no meio do evento
-- ---------------------------------------------------------------------
select tests.como(:admin);
set role authenticated;
update public.app_grupos set lider_id = :lider3 where id = :'g1';
reset role;

-- Líder antigo ainda envia o que ficou pendente no celular
select tests.como(:lider1);
set role authenticated;
insert into public.app_conversoes (id, evento_id, grupo_id, nome, endereco, consentimento, registrado_em)
values ('d0000000-0000-0000-0000-000000000006', :'ev', :'g1', 'Pendente Offline', 'Rua P', true,
        now() - interval '30 minutes');
select tests.ok(true, 'líder substituído envia registro que estava pendente');
reset role;

-- Novo líder registra e não vê os dados do anterior
select tests.como(:lider3);
set role authenticated;
insert into public.app_conversoes (id, evento_id, grupo_id, nome, endereco, consentimento, registrado_em)
values ('d0000000-0000-0000-0000-000000000007', :'ev', :'g1', 'Novo Líder Registro', 'Rua N', true, now());
select tests.ok((select count(*) from public.app_conversoes) = 1, 'novo líder vê só o que ele registrou');
select tests.ok(
  (select total from public.app_placar(:'ev') where grupo_nome = 'Grupo 1') = 7,
  'placar do Grupo 1 soma os dois líderes (7)');
reset role;

-- Registros do líder anterior continuam no nome dele
select tests.ok(
  (select count(*) from public.app_conversoes where registrado_por = :lider1 and grupo_id = :'g1') = 6,
  'registros anteriores continuam no nome do líder 1');

-- ---------------------------------------------------------------------
-- 7. Admin vê tudo, exporta, encerra o evento
-- ---------------------------------------------------------------------
select tests.como(:admin);
set role authenticated;

select tests.ok((select count(*) from public.app_conversoes) = 7, 'admin vê todos os registros');
insert into public.app_exportacoes (evento_id, formato, quantidade) values (:'ev', 'xlsx', 7);
select tests.ok(
  (select exportado_por = auth.uid() from public.app_exportacoes limit 1),
  'exportação fica registrada no nome do admin');
select tests.ok(
  tests.linhas('update public.app_exportacoes set quantidade = 0') = 0,
  'registro de exportação não pode ser alterado');

update public.app_eventos set status = 'encerrado' where id = :'ev';
select tests.ok(
  tests.linhas('delete from public.app_eventos') = 0,
  'evento do app não pode ser apagado, só encerrado');

reset role;

select tests.como(:lider3);
set role authenticated;
select tests.bloqueado(
  format($$insert into public.app_conversoes (id, evento_id, grupo_id, nome, endereco, consentimento, registrado_em)
           values (gen_random_uuid(), %L, %L, 'Depois', 'Rua D', true, now())$$, :'ev', :'g1'),
  'após encerrar, líder não registra mais');
select tests.ok(
  tests.linhas($$update public.app_conversoes set apelido = 'x', atualizado_em = now()$$) = 0,
  'após encerrar, líder não corrige mais');
reset role;

-- ---------------------------------------------------------------------
-- 8. Site protegido
-- ---------------------------------------------------------------------
select tests.bloqueado(
  $$delete from public.eventos where id = __ID1__$$,
  'evento do site com dados no app não pode ser apagado');
select tests.ok(
  tests.linhas($$delete from public.eventos where id = __ID3__$$) = 1,
  'evento do site sem uso no app continua podendo ser apagado');

\echo ''
\echo 'Todos os testes passaram.'
