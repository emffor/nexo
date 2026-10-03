# Nexo

Workspace para organizar cards Markdown, Kanban, diagramas de cards e modelagem DBML. Aplicação Next.js 14 / React 18, TypeScript, Tailwind, Prisma e PostgreSQL. Preferências de interface ficam no localStorage; dados atuais são acessados por APIs. Dexie permanece em código legado e testes.

## Desenvolvimento

Use a versão de Node indicada em `.node-version` e pnpm. Configure um `.env` privado a partir de `.env.example`, com `DATABASE_URL` apontando para o ambiente correto. Nunca versione credenciais.

```sh
pnpm install --frozen-lockfile
pnpm exec prisma generate
pnpm dev
```

A geração do Prisma Client não aplica schema. Preparação do PostgreSQL, criação de rede/volume Docker e aplicação de schema são operações separadas que exigem revisão e autorização. Não execute reset, seed ou migrations contra um banco existente como preparação de testes.

## Verificação

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm audit --prod
```

Vitest executa apenas `src/**/*.test.{ts,tsx}`; worktrees locais não entram na suíte. Testes usam mocks HTTP/Prisma e fake-indexeddb. Não apontar a suíte para banco real. Os testes de canvas simulam Konva e precisam de validação complementar no navegador.

Evite executar `next dev` e `next build` sobre o mesmo `.next` simultaneamente. Para revisão paralela, use uma cópia isolada do projeto.

## Operação e segurança

O Dockerfile produz `standalone` e executa como usuário sem privilégios. O compose usa volume e rede externos; confirme sua existência e configuração antes de subir containers. Não há autenticação de usuários nas APIs: a aplicação requer uma fronteira de acesso confiável até que um modelo de identidade/autorização seja implementado.

A integração Jira usa variáveis somente no servidor (`JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`) e as rotas são bloqueadas em produção. Não coloque tokens em variáveis `NEXT_PUBLIC_*`.

Leia [arquitetura](ARQUITETURA.md) e [análise, melhorias e pendências](ANALISE_PROJETO.md) antes de alterar contratos ou preparar publicação.
