# Banco de dados — App de Registro de Conversões

Etapa 1 do app: as tabelas, funções e regras de acesso no Supabase da missão.

## O que isso muda no Supabase

- **Cria** 6 tabelas com prefixo `app_` e as funções do app.
- **Não altera** nenhuma tabela do site (`eventos`, `perfis`, `inscricoes`, `certificados`).
- Do site, o app só **lê** `eventos` e `perfis`, por funções próprias.
- Única proteção nova que toca o site: um evento do site que já tenha dados no app não pode ser apagado (pode ser editado e encerrado normalmente).

| Tabela | Para quê |
| --- | --- |
| `app_papeis` | Quem é admin do app |
| `app_eventos` | Cada impacto, ligado a um evento do site |
| `app_grupos` | Grupos de missionários e o líder de cada um |
| `app_lideres_historico` | Quem já liderou cada grupo (preenchida sozinha) |
| `app_conversoes` | Cada pessoa alcançada |
| `app_exportacoes` | Registro de quem exportou o quê e quando |

## Arquivos

```
supabase/
  migrations/
    20261102000100_app_conversoes.sql      tabelas, funções e regras de acesso
    20261102000200_app_realtime_placar.sql aviso em tempo real do placar
    20261102000300_app_avisos_completos.sql aviso também ao corrigir e ao apagar
  desfazer/
    desfazer_app_conversoes.sql            remove tudo do app, se precisar voltar atrás
  tests/
    rodar_testes.sh                        roda os 68 testes num PostgreSQL local
```

## Como aplicar no Supabase

1. Abra o projeto da missão no Supabase → **SQL Editor** → **New query**.
2. Cole o conteúdo de `20261102000100_app_conversoes.sql` e clique em **Run**.
   A migration roda numa transação: se der qualquer erro, nada é gravado.
3. Faça o mesmo com `20261102000200_app_realtime_placar.sql` e depois com `20261102000300_app_avisos_completos.sql`, nessa ordem.
4. Cadastre os admins do app trocando os e-mails pelos das contas do site:

   ```sql
   insert into public.app_papeis (user_id, papel)
   select id, 'admin'
   from auth.users
   where email in (
     'email-do-ezequias@exemplo.com',
     'email-do-bruno@exemplo.com',
     'email-do-presidente@exemplo.com'
   );
   ```

5. Confira se deu certo (deve listar as 6 tabelas e os 3 admins):

   ```sql
   select table_name from information_schema.tables
   where table_schema = 'public' and table_name like 'app\_%';

   select u.email from public.app_papeis a join auth.users u on u.id = a.user_id;
   ```

6. Abra o site e confira que login, painel e admin funcionam como antes.

## Como voltar atrás

Rode `desfazer/desfazer_app_conversoes.sql` no SQL Editor. Ele apaga as tabelas e funções do app (e os dados delas) e deixa o site exatamente como estava.

## Regras de acesso, em resumo

| | Admin | Líder escalado | Conta sem função | Visitante |
| --- | --- | --- | --- | --- |
| Criar evento e grupos | Sim | Não | Não | Não |
| Registrar conversão | Sim | No próprio grupo, com evento ativo | Não | Não |
| Ver dados pessoais | Todos | Só os que registrou | Não | Não |
| Ver placar | Sim | Dos seus eventos | Não | Não |
| Exportar | Sim | Não | Não | Não |
| Apagar conversão | Sim | Não | Não | Não |

Detalhes que o banco garante sozinho, mesmo que alguém tente burlar o app:

- O autor do registro é sempre a conta logada.
- O grupo precisa ser do evento informado.
- Reenviar o mesmo registro (mesmo `id`) não cria duplicata.
- Sem consentimento marcado, o registro não é salvo.
- Campos de responsável só ficam gravados para menores de 18 anos.
- Hora do celular adiantada é corrigida para a hora do servidor.
- Correção antiga chegando depois de uma mais nova é ignorada.
- Líder substituído no meio do evento ainda consegue enviar o que ficou pendente no celular.
- Depois que o evento é encerrado, ninguém além do admin registra ou corrige.
- O aviso do placar em tempo real não leva nenhum dado pessoal.

## Testes

`supabase/tests/rodar_testes.sh` cria um banco local que imita o Supabase, aplica as migrations e roda 68 testes com cinco contas (admin, três líderes e uma sem função). Ele roda tudo duas vezes: com o `id` dos eventos do site como `uuid` e como número, para funcionar com qualquer um dos dois.
