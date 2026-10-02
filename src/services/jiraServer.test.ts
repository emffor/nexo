import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getJiraAttachment, importJiraIssue } from './jiraServer';

beforeEach(() => {
  vi.stubEnv('JIRA_BASE_URL', 'https://example.atlassian.net');
  vi.stubEnv('JIRA_EMAIL', 'integration@example.com');
  vi.stubEnv('JIRA_API_TOKEN', 'test-token');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('consulta Jira no servidor', () => {
  it('carrega bytes da imagem pelo endpoint autenticado de anexos sem redirecionar', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'Content-Type': 'image/png' } }));
    vi.stubGlobal('fetch', fetchMock);
    const image = await getJiraAttachment('123');
    expect(image.contentType).toBe('image/png');
    expect(new Uint8Array(image.content)).toEqual(new Uint8Array([137, 80, 78, 71]));
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.href).toBe('https://example.atlassian.net/rest/api/3/attachment/content/123?redirect=false');
    expect(options.redirect).toBe('error');
    expect(options.headers.Accept).toBe('*/*');
    expect(options.headers.Authorization).toMatch(/^Basic /);
  });

  it.each(['../other', 'https://attacker.com/image', '123?redirect=true'])('rejeita identificador de imagem inválido: %s', async (id) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(getJiraAttachment(id)).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['text/html', 'image/svg+xml', 'application/pdf'])('rejeita conteúdo que não é imagem segura: %s', async (contentType) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('content', { headers: { 'Content-Type': contentType } })));
    await expect(getJiraAttachment('123')).rejects.toMatchObject({ status: 415 });
  });

  it('recusa imagem acima do limite antes de ler o corpo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('content', { headers: { 'Content-Type': 'image/png', 'Content-Length': String(21 * 1024 * 1024) } })));
    await expect(getJiraAttachment('123')).rejects.toMatchObject({ status: 413 });
  });

  it('busca somente na origem configurada e autentica sem retornar o token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ key: 'P2M-1', fields: { summary: 'Task' } })));
    vi.stubGlobal('fetch', fetchMock);
    const card = await importJiraIssue('p2m-1');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url.href).toBe('https://example.atlassian.net/rest/api/3/issue/P2M-1?fields=*all&expand=names,schema');
    expect(options).toMatchObject({ cache: 'no-store', redirect: 'error', headers: { Accept: 'application/json' } });
    expect(options.headers.Authorization).toBe(`Basic ${Buffer.from('integration@example.com:test-token').toString('base64')}`);
    expect(card.title).toBe('P2M-1');
    expect(card.content).not.toContain('test-token');
  });

  it.each(['../other', 'https://example.atlassian.net/browse/P2M-1', 'P2M-1?expand=all'])('rejeita chave inválida: %s', async (key) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(importJiraIssue(key)).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['http://example.atlassian.net', 'https://attacker.com', 'https://example.atlassian.net/other'])('rejeita configuração insegura: %s', async (url) => {
    vi.stubEnv('JIRA_BASE_URL', url);
    await expect(importJiraIssue('P2M-1')).rejects.toMatchObject({ status: 503 });
  });

  it('informa configuração ausente', async () => {
    vi.stubEnv('JIRA_API_TOKEN', '');
    await expect(importJiraIssue('P2M-1')).rejects.toMatchObject({ status: 503 });
  });

  it.each([[401, 502], [403, 502], [404, 404], [429, 429], [500, 502]])('trata status %i sem expor resposta do Jira', async (upstreamStatus, status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private upstream error', { status: upstreamStatus })));
    await expect(importJiraIssue('P2M-1')).rejects.toMatchObject({ status });
    await expect(importJiraIssue('P2M-1')).rejects.not.toHaveProperty('message', 'private upstream error');
  });

  it('trata indisponibilidade de rede', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private network error')));
    await expect(importJiraIssue('P2M-1')).rejects.toMatchObject({ status: 502, message: 'Não foi possível conectar ao Jira. Tente novamente.' });
  });

  it('trata resposta inválida', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ fields: {} }))));
    await expect(importJiraIssue('P2M-1')).rejects.toMatchObject({ status: 502 });
  });
});
