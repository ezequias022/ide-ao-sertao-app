-- =====================================================================
-- Testes de exclusão (admin limpando teste) e dos avisos da migration 003.
-- Roda depois de 10 e 20, aproveitando os dados.
-- =====================================================================
\set ON_ERROR_STOP on
\set QUIET on

\set admin   '''a0000000-0000-0000-0000-000000000001'''
\set lider1  '''b0000000-0000-0000-0000-000000000001'''

select ev, g1, g2 from tests.ids \gset

-- O evento foi encerrado no teste 10: reabre para os testes de líder.
update public.app_eventos set status = 'ativo' where id = :'ev';
delete from realtime.messages;

-- Líder não apaga
select tests.como(:lider1);
set role authenticated;
select tests.ok(
  tests.linhas($$delete from public.app_conversoes where id = 'd0000000-0000-0000-0000-000000000001'$$) = 0,
  'líder não apaga a própria conversão');
reset role;

-- Admin: grupo com conversões não sai; apaga as conversões e depois o grupo
select tests.como(:admin);
set role authenticated;

select tests.bloqueado(
  format($$delete from public.app_grupos where id = %L$$, :'g1'),
  'grupo com conversões não pode ser removido');

select tests.ok(
  tests.linhas(format($$delete from public.app_conversoes where id = 'd0000000-0000-0000-0000-000000000001' and grupo_id = %L$$, :'g1')) = 1,
  'admin apaga uma conversão');

select tests.ok(
  tests.linhas(format($$update public.app_conversoes set apelido = 'Corrigido' where id = 'd0000000-0000-0000-0000-000000000002'$$)) = 1,
  'admin corrige uma conversão');

select tests.ok(
  tests.linhas(format($$delete from public.app_conversoes where grupo_id = %L$$, :'g1')) = 6,
  'admin apaga todas as conversões restantes do grupo');

select tests.ok(
  (select total from public.app_placar(:'ev') where grupo_id = :'g1') = 0,
  'placar do grupo volta a zero');

select tests.ok(
  tests.linhas(format($$delete from public.app_grupos where id = %L$$, :'g1')) = 1,
  'grupo vazio pode ser removido');

select tests.ok(
  not exists (select 1 from public.app_lideres_historico where grupo_id = :'g1'),
  'histórico de líderes do grupo removido junto');
reset role;

-- Avisos em tempo real
select tests.ok(
  (select count(*) from realtime.messages where event = 'conversao_apagada') = 7,
  'cada exclusão gerou um aviso');
select tests.ok(
  (select count(*) from realtime.messages where event = 'conversao_atualizada') = 1,
  'a correção gerou um aviso');
select tests.ok(
  not exists (select 1 from realtime.messages where payload ? 'nome' or payload ? 'endereco' or payload ? 'whatsapp'),
  'avisos sem dados pessoais');

\echo ''
\echo 'Testes de exclusão passaram.'
