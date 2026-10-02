import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { getJiraAttachment, JiraImportError } from '../../../../../services/jiraServer';

vi.mock('../../../../../services/jiraServer', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../../services/jiraServer')>();
  return { ...original, getJiraAttachment: vi.fn() };
});
beforeEach(() => { vi.stubEnv('NODE_ENV', 'development'); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const request = () => GET(new Request('http://localhost:3000/api/jira/attachments/123'), { params: { id: '123' } });

describe('GET /api/jira/attachments/[id]', () => {
  it('retorna os bytes da imagem com MIME correto sem cache ou credenciais', async () => {
    vi.mocked(getJiraAttachment).mockResolvedValue({ content: new Uint8Array([137, 80, 78, 71]).buffer, contentType: 'image/png' });
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
  });

  it('retorna erro de anexo em JSON', async () => {
    vi.mocked(getJiraAttachment).mockRejectedValue(new JiraImportError('Imagem indisponível.', 404));
    const response = await request();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Imagem indisponível.' });
  });

  it('bloqueia consulta em produção sem proteção de acesso', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect((await request()).status).toBe(503);
    expect(getJiraAttachment).not.toHaveBeenCalled();
  });
});
