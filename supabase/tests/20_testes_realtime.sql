-- =====================================================================
-- Testes do aviso de placar em tempo real (migration 002).
-- Roda depois de 10_testes_regras_de_acesso.sql, aproveitando os dados.
-- =====================================================================
\set ON_ERROR_STOP on
\set QUIET on

\set admin   '''a0000000-0000-0000-0000-000000000001'''
\set lider2  '''b0000000-0000-0000-0000-000000000002'''
\set semfunc '''c0000000-0000-0000-0000-000000000001'''

select ev from tests.ids \gset

select tests.ok(
  (select count(*) from realtime.messages where topic = 'placar:' || :'ev') = 7,
  'cada conversão gerou um aviso no canal do placar');

select tests.ok(
  not exists (
    select 1 from realtime.messages
    where payload::text ilike '%José%' or payload ? 'nome' or payload ? 'endereco'
  ),
  'os avisos não carregam dados pessoais');

select set_config('realtime.topic', 'placar:' || :'ev', false);

select tests.como(:lider2);
set role authenticated;
select tests.ok((select count(*) from realtime.messages) = 7, 'líder do evento ouve o canal do placar');
reset role;

select tests.como(:semfunc);
set role authenticated;
select tests.ok((select count(*) from realtime.messages) = 0, 'conta sem função não ouve o canal');
reset role;

select tests.como(:admin);
set role authenticated;
select tests.ok((select count(*) from realtime.messages) = 7, 'admin ouve o canal');
reset role;

\echo ''
\echo 'Testes de tempo real passaram.'
