import { afterEach, describe, expect, it, vi } from 'vitest';
import { updateItemApi } from './itemsApi';

afterEach(() => vi.unstubAllGlobals());

describe('updateItemApi', () => {
  it('envia null ao remover status e observação', async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ id: 'card' }));
    vi.stubGlobal('fetch', request);
    await updateItemApi('card', { status: undefined, observation: undefined });
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ status: null, observation: null });
  });

  it('não limpa campos ausentes de uma edição de conteúdo', async () => {
    const request = vi.fn().mockResolvedValue(Response.json({ id: 'card' }));
    vi.stubGlobal('fetch', request);
    await updateItemApi('card', { content: '# Atualizado' });
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ content: '# Atualizado' });
  });
});
