import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { importJiraIssue, JiraImportError } from '../../../../../services/jiraServer';

vi.mock('../../../../../services/jiraServer', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../../../services/jiraServer')>();
  return { ...original, importJiraIssue: vi.fn() };
});

beforeEach(() => { vi.stubEnv('NODE_ENV', 'development'); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

const request = () => GET(new Request('http://localhost:3000/api/jira/issues/P2M-1240'), { params: { key: 'P2M-1240' } });

describe('GET /api/jira/issues/[key]', () => {
  it('retorna o Markdown da task em JSON sem cache', async () => {
    vi.mocked(importJiraIssue).mockResolvedValue({ title: 'P2M-1240', content: '# Task' });
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({ title: 'P2M-1240', content: '# Task' });
    expect(importJiraIssue).toHaveBeenCalledWith('P2M-1240');
  });

  it('retorna falhas do Jira em JSON com status correspondente', async () => {
    vi.mocked(importJiraIssue).mockRejectedValue(new JiraImportError('Task não encontrada.', 404));
    const response = await request();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Task não encontrada.' });
  });

  it('não expõe detalhes de erros inesperados', async () => {
    vi.mocked(importJiraIssue).mockRejectedValue(new Error('private error'));
    const response = await request();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Falha ao importar task do Jira.' });
  });

  it('não consulta tasks privadas em produção sem proteção de acesso', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = await request();
    expect(response.status).toBe(503);
    expect(importJiraIssue).not.toHaveBeenCalled();
  });
});
