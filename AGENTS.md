# AGENTS.md

## Escopo E Precedência

- Este arquivo define o padrão esperado para esta aplicação Next.js.
- Em caso de conflito, vale a ordem:
  1. Instrução direta do usuário
  2. `AGENTS.md` mais próximo do arquivo alterado
  3. `AGENTS.md` de diretórios superiores
  4. Documentação interna do repositório
  5. Este arquivo
  6. Padrões padrão da ferramenta

## Objetivo

- Manter a aplicação simples, previsível e fácil de manter.
- Priorizar componentes pequenos, tipados e reutilizáveis.
- Separar regra de negócio da camada visual.
- Evitar lógica complexa dentro de componentes React.
- Garantir compatibilidade com Next.js, TypeScript, Tailwind e Vitest.
- Evitar mudanças estruturais desnecessárias.

## Stack Do Projeto

- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Dexie / IndexedDB
- React Markdown
- dnd-kit
- Vitest
- Testing Library

## Padrão Base Do Projeto

- Usar o padrão já existente no projeto antes de criar nova estrutura.
- Manter organização consistente entre:
  - componentes
  - hooks
  - services
  - tipos
  - funções utilitárias
  - testes
- Não reinventar fluxo, nomes ou arquitetura quando já houver padrão equivalente.
- Preferir evolução incremental em vez de reescrita ampla sem necessidade.

## Organização Recomendada

- `components/`
  - Componentes visuais reutilizáveis.
  - Não devem conter regra de negócio pesada.

- `hooks/`
  - Estado de tela.
  - Integração entre UI e services.
  - Composição de comportamentos reutilizáveis.

- `services/`
  - Regras de negócio.
  - Persistência com Dexie.
  - Manipulação de dados.
  - Conversões e operações assíncronas.

- `lib/`
  - Configurações globais.
  - Instâncias compartilhadas.
  - Helpers técnicos.

- `types/`
  - Tipos e interfaces reutilizáveis.

- `utils/`
  - Funções puras e pequenas.
  - Não devem depender de React.

- `tests/` ou arquivos `*.test.ts(x)`
  - Testes unitários e de comportamento.

## Padrão De Código Obrigatório

- Responder sempre em português do Brasil.
- Usar TypeScript com tipagem explícita quando melhorar clareza.
- Evitar `any`, exceto quando houver justificativa real.
- Preferir `type` para modelos simples e `interface` quando houver extensão clara.
- Usar nomes descritivos em português ou inglês, mantendo o padrão já usado no projeto.
- Não misturar idiomas de forma aleatória no mesmo contexto.
- Evitar comentários óbvios.
- Usar comentários apenas para explicar regra não evidente.
- Não criar abstrações prematuras.
- Não criar arquivos novos sem necessidade clara.
- Não alterar dependências sem explicar o motivo.
- Não remover código existente sem confirmar impacto.

## Componentes React

- Componentes devem ser pequenos e focados.
- Separar componentes grandes em partes menores quando houver ganho real de leitura.
- Evitar lógica de negócio dentro do JSX.
- Evitar `useEffect` desnecessário.
- Preferir estado derivado quando possível.
- Evitar duplicação de estado.
- Não usar manipulação direta do DOM salvo necessidade real.
- Props devem ser tipadas.
- Eventos devem ter nomes claros.
- Componentes devem ser previsíveis e fáceis de testar.

## Next.js

- Respeitar o padrão de roteamento existente no projeto.
- Usar Client Components apenas quando necessário.
- Marcar com `"use client"` somente arquivos que usam:
  - estado React
  - efeitos
  - eventos de usuário
  - browser APIs
  - Dexie / IndexedDB
  - drag and drop
- Evitar transformar tudo em Client Component por preguiça arquitetural, essa epidemia humana lamentável.
- Não acessar `window`, `document`, `localStorage` ou IndexedDB em Server Components.
- Garantir que código dependente do navegador rode apenas no client.

## Dexie / IndexedDB

- Centralizar configuração do banco em local próprio.
- Não espalhar acesso direto ao banco por vários componentes.
- Preferir services para operações de leitura, escrita, atualização e remoção.
- Toda operação assíncrona deve tratar erro de forma previsível.
- Evitar duplicação de queries.
- Manter tipos alinhados com as tabelas.
- Cuidado com mudanças de schema e versionamento do Dexie.

## Markdown

- Sanitizar ou controlar cuidadosamente HTML renderizado.
- Usar `rehype-raw` apenas quando realmente necessário.
- Considerar riscos de XSS ao renderizar conteúdo vindo do usuário.
- Não confiar cegamente em Markdown salvo no IndexedDB.
- Centralizar configuração do renderizador Markdown quando possível.

## Drag And Drop

- Usar `@dnd-kit` seguindo o padrão já existente.
- Manter lógica de reordenação fora do JSX quando possível.
- Garantir atualização consistente da ordem dos itens.
- Evitar mutação direta de arrays.
- Preservar acessibilidade básica quando possível.

## Tailwind CSS

- Usar Tailwind de forma simples e legível.
- Evitar classes gigantes impossíveis de manter.
- Extrair componentes quando houver repetição visual relevante.
- Não criar CSS global sem necessidade.
- Manter responsividade quando alterar layout.

## Testes

- Usar Vitest e Testing Library.
- Testar comportamento, não implementação interna.
- Priorizar testes para:
  - regras de negócio
  - persistência
  - transformação de dados
  - hooks relevantes
  - fluxos críticos de UI
- Não escrever testes frágeis baseados em detalhes visuais irrelevantes.
- Usar `fake-indexeddb` para testes envolvendo Dexie.
- Ao alterar regra existente, ajustar ou criar testes correspondentes.

## Tratamento De Erros

- Não silenciar erros.
- Exibir mensagens claras para o usuário quando houver falha.
- Manter logs técnicos apenas quando úteis para debug.
- Evitar `console.log` em código final.
- Usar `console.error` apenas quando fizer sentido operacional.
- Não deixar `debugger`, `TODO`, `FIXME` ou código morto.

## Performance

- Evitar renderizações desnecessárias.
- Usar `useMemo` e `useCallback` apenas quando houver ganho real.
- Evitar otimização decorativa que só deixa o código mais feio.
- Cuidar com listas grandes, filtros e reordenação.
- Evitar recriar funções e objetos complexos dentro do render sem necessidade.

## Acessibilidade

- Elementos interativos devem ser acessíveis por teclado quando aplicável.
- Botões devem ser botões reais.
- Inputs devem ter label ou descrição acessível.
- Não usar `div` clicável quando `button` resolve.
- Preservar foco e legibilidade visual.

## Segurança

- Não expor dados sensíveis em logs.
- Não usar `dangerouslySetInnerHTML` sem necessidade explícita.
- Tratar conteúdo Markdown/HTML como potencialmente inseguro.
- Não adicionar dependências desconhecidas para resolver problemas simples.
- Validar dados antes de persistir.

## Commits E Alterações

- Fazer alterações pequenas e coesas.
- Não misturar refatoração ampla com mudança funcional.
- Não alterar formatação geral do projeto sem necessidade.
- Preservar comportamento existente salvo instrução contrária.
- Antes de sugerir mudança grande, explicar trade-offs.
- Sugerir mensagens de commit sempre em português do Brasil.
- Mensagens de commit devem ser curtas, claras e objetivas.
- Preferir commits descritivos e semanticamente organizados.
- Preferir padrão:
  - `feat: adiciona ...`
  - `fix: corrige ...`
  - `refactor: melhora ...`
  - `test: adiciona ...`
  - `chore: ajusta ...`
  - `docs: atualiza ...`
- Evitar commits genéricos ou inúteis como:
  - `ajustes`
  - `fix bug`
  - `update`
  - `melhorias`
  - `alterações`
  - `teste`
- Quando possível, mencionar contexto funcional no commit:
  - módulo
  - fluxo
  - tela
  - comportamento alterado
- Evitar mensagens excessivamente longas.
- Evitar misturar múltiplos objetivos no mesmo commit.
- Em implementações relevantes, sugerir uma mensagem de commit pronta ao final da resposta.

## Quando Revisar Código

- Focar em problemas reais:
  - bug
  - regressão
  - quebra de contrato
  - risco de segurança
  - perda de dados
  - problema de performance relevante
  - comportamento inconsistente
- Ignorar preferência estética sem impacto.
- Não inventar problema sem evidência.
- Se não houver problema real, dizer objetivamente.

## Resposta Esperada Da IA

- Ser direto e objetivo.
- Explicar somente o necessário.
- Mostrar código pronto quando o pedido for implementação.
- Quando houver ambiguidade relevante, perguntar antes de alterar.
- Quando a intenção for clara, agir sem enrolação.
- Não sugerir arquitetura maior do que o problema pede.
