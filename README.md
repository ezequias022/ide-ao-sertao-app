# Ide ao Sertão — Registro de Conversões

App interno da **Missão Ide ao Sertão** para os líderes de grupo registrarem as conversões durante os impactos evangelísticos, mesmo sem internet, e para a liderança acompanhar tudo em tempo real e repassar as listas aos pastores locais.

> Status: **v0.1** — login, eventos do líder e área do admin (criar impacto, grupos e escalação de líderes).
> Próximas etapas: registro offline, placar ao vivo, exportação, APK.

## Tecnologias

| Camada | Escolha |
| --- | --- |
| Interface | React 18 + Ionic 8 (visual de app nativo) |
| Linguagem | TypeScript (modo estrito) |
| Build | Vite |
| App Android | Capacitor 8 |
| Backend | Supabase (Auth, PostgreSQL com RLS, Realtime), o mesmo do site |
| Testes | Vitest (app) e testes SQL das regras de acesso (banco) |

## Como rodar

```bash
npm install
npm run dev:demo   # modo demonstração, dados fictícios, sem Supabase
npm run dev        # conectado ao Supabase da missão
```

No modo demonstração, entre com `admin@demo` ou `lider@demo` e a senha `demo`.

## Scripts

| Comando | O que faz |
| --- | --- |
| `npm run dev` / `dev:demo` | Servidor de desenvolvimento |
| `npm run build` | Checa os tipos e gera o app em `dist/` |
| `npm test` | Testes do app |
| `npm run test:banco` | Testes das regras de acesso do banco (precisa de PostgreSQL local) |

## Organização

```
src/
  dados/        acesso a dados: interface única + Supabase + modo demonstração
  sessao/       login e papel do usuário (admin ou líder)
  telas/        telas do app (admin/ = área da liderança)
  componentes/  peças reutilizadas
  tema/         cores e tipografia da missão
  util/         formatação e utilitários
supabase/
  migrations/   criação das tabelas app_*, funções e regras de acesso
  tests/        testes das regras de acesso
  desfazer/     script para remover tudo do app do banco
```

## Decisões de arquitetura

- **Mesmo banco do site, sem alterar o site.** O app só cria tabelas com prefixo `app_` e lê `eventos` e `perfis` por funções próprias.
- **Segurança no banco, não no app.** As regras de acesso (RLS) garantem quem vê e quem altera o quê, mesmo que alguém use a API direto. Ver `supabase/LEIA-ME.md`.
- **Camada de dados trocável.** As telas usam só a interface `Repositorio`; o modo demonstração usa as mesmas regras e permite testar sem tocar no banco real.
- **Chave pública no código.** A chave `publishable` do Supabase é feita para ficar no app; o que protege os dados são as regras de acesso.
- **Visual único.** Modo `md` do Ionic no Android e no iPhone, tema claro e alto contraste para uso no sol.
