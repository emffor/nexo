# Estrutura React

- `src/App.tsx`: composição dos providers e entrada da aplicação.
- `contexts/PreferencesContext.tsx`: tema, modo de visualização, fonte e estilos de linhas compartilhados entre a lista de projetos e o workspace. Sincroniza preferências com localStorage e o tema do documento.
- `components/ProjectsScreen.tsx` e `hooks/useProjects.ts`: navegação, carregamento, ações e backups de projetos. Respostas obsoletas de carregamento são ignoradas.
- `components/ProjectWorkspace.tsx` e `hooks/useProjectWorkspace.ts`: composição do editor, cards, confirmações, backups e integração dos hooks existentes. O workspace é remontado pela chave do projeto para isolar seu estado.
- `hooks/useMarkdownBoard.ts` e `hooks/useDatabaseDiagram.ts`: dados dos cards e autosave do DBML, usando as APIs existentes.
- `hooks/useCardDiagramCanvas.ts` e `hooks/useDatabaseCanvas.ts`: interação e estado dos diagramas. Zoom e enquadramento do banco ficam em `useDatabaseViewport.ts`; medição e scroll têm hooks próprios.
- `components/database/DatabaseTables.tsx`, `DatabaseRelations.tsx` e `CardinalityMarker.tsx`: desenho das tabelas, relações e cardinalidade no Konva.
- `lib/diagramGeometry.ts` e `lib/databaseDiagramGeometry.ts`: cálculos de coordenadas e caminhos, independentes de React.
- `lib/previewStrikethrough.ts` e `lib/textFiles.ts`: formatação da seleção e leitura/download de arquivos.
- `types/diagramCanvas.ts` e `types/databaseCanvas.ts`: contratos compartilhados dos painéis e controladores.

Estado de edição, seleção, hover e arraste permanece local ao domínio. Context é usado para preferências compartilhadas. Seleção ativa e IDs ocultos válidos são derivados dos cards; ações de visibilidade persistem no evento. Effects permanecem para integração com APIs, DOM, canvas, listeners e autosave.

O modal monta uma sessão de edição ao abrir e ao trocar o conteúdo inicial. Fechar desmonta a sessão e cancela a busca Jira pendente. Falhas ao salvar mantêm o rascunho aberto.

## Validação

Use `pnpm test` e `pnpm build`. Os testes de estrutura (`App.structure.test.tsx`), preferências e workspace usam APIs simuladas. Os testes dos diagramas simulam Konva e não substituem uma verificação visual no navegador.

A baseline desta refatoração tinha 44 testes falhando em `App.test.tsx`, `lib/projects.test.ts` e `hooks/useDatabaseDiagram.test.tsx`, que ainda dependem de premissas antigas de persistência/API. Esses testes foram preservados. O script `pnpm lint` ainda solicita configuração inicial do ESLint.
