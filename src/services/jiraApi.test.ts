import { afterEach, describe, expect, it, vi } from 'vitest';
import { getJiraCardApi } from './jiraApi';

afterEach(() => { vi.unstubAllGlobals(); });

describe('cliente da integração Jira', () => {
  it('mostra mensagem clara ao receber HTML de 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<!DOCTYPE html><html></html>', { status: 404 })));
    await expect(getJiraCardApi('P2M-1240')).rejects.toThrow('Verifique se a rota da integração está disponível.');
  });

  it.each([null, {}, { title: 'P2M-1240' }])('rejeita resposta JSON inválida %j', async (data) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(data))));
    await expect(getJiraCardApi('P2M-1240')).rejects.toThrow(/resposta inválida/i);
  });

  it('preserva mensagem de erro do endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Task não encontrada.' }), { status: 404 })));
    await expect(getJiraCardApi('P2M-1240')).rejects.toThrow('Task não encontrada.');
  });
});
