import { describe, expect, it } from 'vitest';
import { adfToMarkdown, jiraIssueToMarkdown } from './jiraMarkdown';
import { normalizeMarkdownContent } from './items';

const paragraph = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });

describe('adfToMarkdown', () => {
  it('mantém espaços fora das marcas e não formata espaços vazios', () => {
    expect(adfToMarkdown({ type: 'paragraph', content: [
      { type: 'text', text: 'menu' },
      { type: 'text', text: ' ', marks: [{ type: 'strong' }] },
      { type: 'text', text: ' Precificação ', marks: [{ type: 'strong' }] },
      { type: 'text', text: 'com submenus' },
    ] })).toBe('menu  **Precificação** com submenus');
  });

  it('preserva quebras sem transformar linhas vazias em marcadores ao salvar', () => {
    const markdown = adfToMarkdown({ type: 'paragraph', content: [
      { type: 'text', text: 'Documentos' }, { type: 'hardBreak' }, { type: 'hardBreak' },
      { type: 'text', text: 'Próximo requisito' },
    ] });
    expect(markdown).toBe('Documentos  \n\nPróximo requisito');
    expect(normalizeMarkdownContent(markdown)).toBe(markdown);
  });

  it('preserva títulos, formatação, listas aninhadas e tabelas', () => {
    const markdown = adfToMarkdown({ type: 'doc', content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Requisitos' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Permissão', marks: [{ type: 'strong' }] }] },
      { type: 'orderedList', attrs: { order: 3 }, content: [{ type: 'listItem', content: [
        paragraph('Conceder acesso'),
        { type: 'bulletList', content: [{ type: 'listItem', content: [paragraph('Administrador')] }] },
      ] }] },
      { type: 'table', content: [
        { type: 'tableRow', content: [{ type: 'tableHeader', content: [paragraph('Campo')] }] },
        { type: 'tableRow', content: [{ type: 'tableCell', content: [paragraph('A | B')] }] },
      ] },
    ] });
    expect(markdown).toContain('## Requisitos');
    expect(markdown).toContain('**Permissão**');
    expect(markdown).toContain('3. Conceder acesso\n   \n   - Administrador');
    expect(markdown).toContain('| Campo |\n| --- |\n| A \\| B |');
  });

  it('impede HTML e links executáveis vindos do Jira', () => {
    const markdown = adfToMarkdown({ type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: '<img src=x onerror=alert(1)> &lt;script&gt;', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
      { type: 'inlineCard', attrs: { url: 'data:text/html,unsafe' } },
    ] }] });
    expect(markdown).not.toContain('<img');
    expect(markdown).not.toContain('javascript:');
    expect(markdown).not.toContain('data:');
    expect(markdown).toContain('&lt;img');
    expect(markdown).toContain('&amp;lt;script');
  });

  it('preserva código com backticks sem encerrar o bloco', () => {
    const markdown = adfToMarkdown({ type: 'codeBlock', attrs: { language: 'ts' }, content: [
      { type: 'text', text: 'const x = `a`;\n```' },
    ] });
    expect(markdown).toBe('````ts\nconst x = `a`;\n```\n````');
  });

  it('mantém conteúdo de nós desconhecidos e informa mídia privada', () => {
    expect(adfToMarkdown({ type: 'unknown', content: [paragraph('Texto')] })).toBe('Texto');
    expect(adfToMarkdown({ type: 'media', attrs: { id: 'private-file' } })).toContain('consulte o Jira');
    expect(adfToMarkdown(null)).toBe('');
  });
});

describe('jiraIssueToMarkdown', () => {
  it('segue o formato manual de metadados e campos personalizados', () => {
    const card = jiraIssueToMarkdown({ key: 'P2M-1175', names: {
      customfield_1: 'Disponibilizado para a tecnologia', customfield_2: 'Link Epic',
      customfield_3: 'Classificação', customfield_4: 'development',
    }, schema: {
      customfield_1: { type: 'date' },
      customfield_2: { custom: 'com.pyxis.greenhopper.jira:gh-epic-link' },
      customfield_3: { custom: 'com.pyxis.greenhopper.jira:gh-lexo-rank' },
      customfield_4: { custom: 'com.atlassian.jira.plugins.jira-development-integration-plugin:devsummarycf' },
    }, fields: {
      summary: 'Precificação | Sidemenu', status: { name: 'BACKLOG_TECH' },
      created: '2026-09-01T14:05:41.515-0300', updated: '2026-10-01T17:24:51.253-0300',
      parent: { key: 'P2M-1172', fields: { summary: 'Precificação' } },
      customfield_1: '2026-09-18', customfield_2: 'P2M-1172', customfield_3: '0|i015w2:sm', customfield_4: '{}',
      description: { type: 'doc', content: [paragraph('USER STORY')] },
    } }, 'https://example.atlassian.net');
    expect(card.content).toContain('# [P2M-1175] Precificação \\| Sidemenu');
    expect(card.content).toContain('**Issue Key:** P2M-1175  \n**URL:**');
    expect(card.content).toContain('**Created:** Tue, 1 Sep 2026 14:05:41 -0300  \n**Updated:** Thu, 1 Oct 2026 17:24:51 -0300');
    expect(card.content).toContain('## Custom Fields\n\n**Disponibilizado para a tecnologia:** Fri, 18 Sep 2026 00:00:00 \\+0000  \n**Link Epic:** Precificação\n\n---\n\nUSER STORY');
    expect(card.content).not.toContain('**Classificação:**');
    expect(card.content).not.toContain('**development:**');
  });

  it.each(['2026-10-01T17:24:51.253+0530', '2026-10-01T17:24:51.253+05:30'])('preserva horário e fuso positivo: %s', (created) => {
    const card = jiraIssueToMarkdown({ key: 'P2M-1', fields: { summary: 'Task', created } }, 'https://example.atlassian.net');
    expect(card.content).toContain('**Created:** Thu, 1 Oct 2026 17:24:51 \\+0530');
  });

  it('preserva data inválida e chave do épico quando seu nome não está disponível', () => {
    const card = jiraIssueToMarkdown({ key: 'P2M-1', names: { customfield_1: 'Link Epic' }, schema: {
      customfield_1: { custom: 'com.pyxis.greenhopper.jira:gh-epic-link' },
    }, fields: { summary: 'Task', created: 'Sem data', customfield_1: 'P2M-2' } }, 'https://example.atlassian.net');
    expect(card.content).toContain('**Created:** Sem data');
    expect(card.content).toContain('**Link Epic:** P2M-2');
  });

  it('mantém a separação dos campos personalizados com conteúdo em blocos', () => {
    const card = jiraIssueToMarkdown({ key: 'P2M-1', names: {
      customfield_1: 'Detalhes', customfield_2: 'Equipe',
    }, fields: { summary: 'Task', customfield_1: { type: 'doc', content: [paragraph('Primeiro'), paragraph('Segundo')] },
      customfield_2: 'Produto',
    } }, 'https://example.atlassian.net');
    expect(card.content).toContain('**Detalhes:** Primeiro\n\nSegundo\n\n**Equipe:** Produto');
  });

  it('exibe imagem privada na posição da mídia usando o proxy local', () => {
    const card = jiraIssueToMarkdown({ key: 'P2M-1240', fields: {
      summary: 'Task',
      description: { type: 'doc', content: [paragraph('Protótipo'),
        { type: 'mediaSingle', content: [{ type: 'media', attrs: { id: 'media-uuid', alt: 'screen.png', type: 'file' } }] },
        paragraph('Após a imagem'),
      ] },
      attachment: [{ id: '123', filename: 'screen.png', mimeType: 'image/png', content: 'https://example.atlassian.net/rest/api/3/attachment/content/123' }],
    } }, 'https://example.atlassian.net');
    expect(card.content).toContain('Protótipo\n\n![screen\\.png](/api/jira/attachments/123)\n\nApós a imagem');
    expect(card.content.match(/!\[/g)).toHaveLength(1);
    expect(card.content).not.toContain('## Anexos');
    expect(card.content).not.toContain('/rest/api/3/attachment/content/123');
  });

  it('mostra imagens sem correspondência de mídia na seção de anexos e mantém PDFs como links', () => {
    const card = jiraIssueToMarkdown({ key: 'P2M-1240', fields: { summary: 'Task', attachment: [
      { id: '123', filename: 'screen.png', mimeType: 'image/png' },
      { id: '124', filename: 'document.pdf', mimeType: 'application/pdf', content: 'https://example.atlassian.net/file/124' },
      { id: '125', filename: 'unsafe.svg', mimeType: 'image/svg+xml', content: 'https://example.atlassian.net/file/125' },
    ] } }, 'https://example.atlassian.net');
    expect(card.content).toContain('## Anexos\n\n![screen\\.png](/api/jira/attachments/123)');
    expect(card.content).toContain('[document\\.pdf](https://example.atlassian.net/file/124)');
    expect(card.content).not.toContain('![unsafe');
  });

  it('gera o card com metadados, campos personalizados, descrição, links e anexos', () => {
    const card = jiraIssueToMarkdown({ key: 'P2M-1185', names: { customfield_1: 'Link Epic' }, fields: {
      summary: 'Orçamento sem preço', status: { name: 'BACKLOG_TECH' }, assignee: null,
      customfield_1: { value: 'Precificação' }, customfield_2: null,
      description: { type: 'doc', content: [paragraph('USER STORY')] },
      attachment: [{ filename: 'requisitos.pdf', content: 'https://example.atlassian.net/file/1' }],
      issuelinks: [{ type: { outward: 'bloqueia' }, outwardIssue: { key: 'P2M-2', fields: { summary: 'Outra task' } } }],
    } }, 'https://example.atlassian.net');
    expect(card.title).toBe('P2M-1185');
    expect(card.content).toContain('# [P2M-1185] Orçamento sem preço');
    expect(card.content).toContain('**Assignee:** Não atribuído');
    expect(card.content).toContain('**Link Epic:** Precificação');
    expect(card.content).not.toContain('customfield_2');
    expect(card.content).toContain('USER STORY');
    expect(card.content).toContain('https://example.atlassian.net/browse/P2M-2');
    expect(card.content).toContain('requisitos\\.pdf');
  });

  it('lida com task sem descrição', () => {
    expect(jiraIssueToMarkdown({ key: 'P2M-1', fields: { summary: 'Task' } }, 'https://example.atlassian.net').content)
      .toContain('_Sem descrição._');
  });
});
