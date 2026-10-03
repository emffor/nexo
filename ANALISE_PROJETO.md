# Análise do Nexo — 03/10/2026

## Escopo e método

Revisão de `src/app`, APIs, componentes, hooks, Context, serviços, bibliotecas de Markdown/DBML/backups/geometria, tipos, Prisma, assets, configuração, Docker e testes. A revisão considera Next.js 14, React 18 e PostgreSQL como implementação atual; Dexie permanece no legado e em testes. Não houve migration, alteração de schema, escrita no PostgreSQL, commit ou deploy.

Foram executados testes com mocks, TypeScript, ESLint, build e auditoria de dependências. A inspeção no Chrome usou uma cópia temporária com API simulada, bloqueando todas as mutações. Testes mockados não comprovam comportamento transacional do PostgreSQL, concorrência entre usuários ou funcionamento do Jira real.

## Melhorias implementadas

| Área | Problema confirmado | Alteração |
| --- | --- | --- |
| Persistência | `undefined` desaparecia do JSON ao remover status/observação | O cliente envia `null` somente quando a limpeza foi explicitamente solicitada |
| Estado da UI | Editar, excluir e limpar alteravam a tela antes da confirmação do servidor | Estado confirmado após sucesso; reordenação mantém resposta imediata e desfaz alteração em caso de falha |
| Importação | Substituição apagava tudo e recriava cards em requisições individuais, perdendo IDs | Operação transacional no endpoint existente, preservando IDs na substituição e no desfazer; importações remapeiam IDs, conexões e posições para permitir copiar entre projetos; colisões abortam a transação |
| Desfazer | Limpar tudo restaurava somente conteúdo dos cards | Restaura também diagrama, visibilidade e DBML |
| Backups | Falha ao ler um projeto era filtrada silenciosamente | Exportação completa falha se qualquer projeto não puder ser lido |
| Carregamento | Falhas em cards/DBML ficavam silenciosas ou geravam rejeições não tratadas | Mensagens e ações para tentar novamente; erros de ações exibidos em toasts |
| Autosave | Reset/importação podiam disputar com salvamento anterior | Aguarda a fila anterior; snapshot com erro permanece disponível para nova tentativa |
| HTTP | GET de diagrama criava registros | GET retorna exemplo em memória se não houver registro e 404 se o projeto não existir |
| Validação | Lotes aceitavam estruturas inválidas e outro projectId | Validação de IDs, tipos, ordem, status e escopo do lote antes de acessar Prisma |
| Ordenação | Novos cards usavam count, que pode repetir ordem após exclusões | Usa maior ordem existente + 1; concorrência entre clientes ainda requer evolução |
| Acessibilidade | Modal de confirmação deixava foco escapar; toasts não eram anunciados | Reutiliza focus trap, IDs únicos, retorno do foco e roles status/alert |
| UX | Editor DBML mostrava um horário fixo sem base real | Removida a indicação falsa de última alteração |
| Recursos | Toast deixava animation frame/timer de saída ativos | Cancela ambos no cleanup |
| Desempenho | Busca de posição no Kanban repetida para cada card | Mapa memoizado de posições; remove consulta duplicada de projetos e libera navegação antes do cálculo de tamanho |
| HTML | Conteúdo importado podia incluir elementos ativos | Bloqueio adicional de script/style/iframe/form/embed etc.; sanitização de atributos ainda pendente |
| Ferramentas | Vitest encontrava testes em `.kilo/worktrees`; lint abria wizard | Testes limitados a `src`, alias `@`, exclusão de worktrees em TypeScript/Docker, ESLint configurado e script typecheck |

## Arquitetura e organização

A composição de `App`, `ProjectsScreen`, `ProjectWorkspace`, Context de preferências, hooks de domínio e serviços HTTP é adequada para evolução incremental. Konva já é carregado dinamicamente. Prisma tem instância compartilhada, relações com cascata e índice composto de cards por projeto/ordem. Não se justifica reescrever essa estrutura.

Pendências: `useCardDiagramCanvas`, `useDatabaseCanvas`, `AppShell`, `CombinedOutputPanel` e parser DBML ainda concentram muitas responsabilidades. Extrair por comportamento quando houver manutenção concreta, com testes de interação, evitando pulverização artificial. `lib/projects` contém orquestração remota apesar do nome `lib`; padronizar esse limite em tarefa própria. Documentação antiga de Dexie deve ser lida como legado, não como contrato atual de persistência.

## Pendências prioritárias

1. **Autenticação e autorização:** as APIs de projetos/cards/diagramas não verificam identidade ou propriedade. A aplicação não define usuários no schema. Se houver acesso externo sem proteção no proxy, qualquer pessoa com acesso à aplicação pode ler e modificar dados. Confirmar o modelo de acesso e a proteção do deploy antes de introduzir login ou isolamento; não foi presumida configuração de Cloudflare Access.
2. **Dependências:** `pnpm audit --prod --json` reportou 27 avisos: 2 críticos, 10 altos, 13 moderados e 2 baixos. A versão instalada é Next.js 14.2.35. Os avisos críticos incluem [otimização de AVIF](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) e [servidores Windows](https://github.com/advisories/GHSA-p293-qw3h-jr36). O segundo não corresponde ao Docker Linux mostrado no repositório. A contagem não significa 27 exploits reproduzidos. A correção reportada exige migração de versão principal do Next, com revisão de APIs/React/Node e novo ciclo de regressão; não foi executada automaticamente.
3. **HTML:** o bloqueio de elementos é uma defesa parcial. `rehype-raw` continua ativo para compatibilidade; atributos como style e conteúdo remoto exigem política explícita e sanitização. A [documentação do react-markdown](https://github.com/remarkjs/react-markdown#security) recomenda `rehype-sanitize`. A nova dependência foi proposta e aguarda autorização explícita conforme as regras do projeto.
4. **Atomicidade entre domínios:** importação de vários projetos e limpeza/restauração envolvendo cards + estado visual + DBML ainda usam várias operações. Uma falha intermediária pode deixar estado parcial. O novo endpoint torna apenas a substituição dos cards transacional. Próximo passo: endpoint de snapshot completo com transação e testes em banco descartável.
5. **Concorrência:** edição por vários clientes, criação simultânea e salvamentos de diagrama de cards não têm controle de versão. Considerar revisão otimista com updatedAt/version e fila por projeto, mediante contrato definido. Fechar a aba não garante término do fetch de autosave; precisa estratégia de recuperação de rascunho/retry explícito.
6. **Validação de APIs:** projetos e JSON visual dos diagramas ainda precisam schemas completos, limites de tamanho, tratamento consistente de 404/409 e erros Prisma sem conteúdo sensível. Rate limiting e proteção de origem dependem do modelo de publicação.
7. **Infraestrutura:** compose publica PostgreSQL em `5435` em todas as interfaces e oferece senha padrão quando variável ausente. Restringir exposição e exigir segredo no deploy; não alterar automaticamente infraestrutura em uso. `DEPLOY.md` local está incompleto e ignorado pelo Git. Volume/rede externos exigem preparação operacional documentada.
8. **Jira:** integração é restrita a desenvolvimento, com allowlist de host, HTTPS, timeout e tipo de imagem. Nenhuma credencial foi lida e nenhum anexo real foi consultado. O tamanho é verificado após carregar o body quando não há Content-Length; leitura streaming limitada é uma melhoria futura. Redirects devem manter allowlist e nunca propagar Authorization a terceiros.

## Interface, UX e acessibilidade

Mantidos tema, navegação, modos de visualização, handlers de seleção e linguagem visual Venture. No Chrome foram inspecionados projetos, preview, Kanban e DBML. Modal reteve foco em Tab/Shift+Tab e devolveu ao acionador. Exclusão com resposta simulada 503 preservou os cards e mostrou erro.

Pendências: verificar mobile e contraste sistematicamente; canvas precisa alternativa navegável por teclado/leitor de tela para seleção e conexões; atalhos globais devem evitar conflito com edição; listas grandes precisam medição antes de virtualização. O preview de cards pode conter links focáveis dentro de um elemento com role button. Testar leitor de tela real, drag por teclado e fluxos longos em uma rodada específica. Não foi feita auditoria WCAG integral.

## Desempenho e documentação

A estatística de tamanho ainda baixa todos os projetos em segundo plano; para grandes bases, preferir agregação no servidor ou cálculo sob demanda. Não há paginação na listagem/API. Exportações completas podem consumir memória proporcional à base. Geometria e roteamento possuem testes, mas faltam benchmarks com centenas de tabelas/cards. Não foram inventadas métricas de melhora.

`ARQUITETURA.md` e `README.md` descrevem os limites atuais, execução e validação. Não foram removidos assets nem dependências legadas sem evidência de impacto.

## Resultados da validação

- Baseline executada antes das alterações: 425 testes descobertos, 84 falhas e 341 aprovações, incluindo a cópia em `.kilo/worktrees`. No `src` principal havia 42 falhas: 40 de integração em `App.test.tsx` e 2 de contratos antigos em `projects.test.ts`.
- Suíte final: **257 testes aprovados em 36 arquivos**, sem falhas. Os 40 cenários de `App.test.tsx` foram preservados e adaptados aos contratos HTTP e à navegação atuais. Foram acrescentados testes de validação de payload, transação mockada, rollback, limpeza de campos, backup incompleto, remapeamento de IDs, desfazer, falhas de carregamento/autosave, HTML e foco.
- `pnpm typecheck`: aprovado.
- `pnpm lint`: aprovado, sem avisos.
- `git diff --check`: aprovado.
- `pnpm build`: aprovado inicialmente no workspace e novamente em cópia isolada com instalação pelo lockfile, incluindo lint e tipos. O isolamento evita compartilhar `.next` com desenvolvimento.
- Ambiente executado: Node 20.18.2 e pnpm 10.30.3. `.node-version` e Dockerfile indicam Node 24.14.0; a imagem Docker não foi construída nesta revisão.
- Dependências reinstaladas com `pnpm install --frozen-lockfile`; Prisma Client regenerado sem conexão/escrita no banco. `pnpm-lock.yaml` permaneceu inalterado.
- Browser: Chrome, viewport desktop, fixture com dois cards e uma tabela, sem persistência real. Conferidos projetos, normal, Kanban, DBML, Tab/Shift+Tab no modal e falha de exclusão.
- Não executados: integração com PostgreSQL real, migrations, deploy, teste Jira autenticado, testes de carga, dispositivos móveis e auditoria completa com leitor de tela.

Os avisos da auditoria de dependências permanecem pendentes; não há alegação de segurança integral ou de ausência de regressões fora dos cenários verificados.
