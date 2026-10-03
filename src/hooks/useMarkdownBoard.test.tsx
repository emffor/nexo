import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMarkdownBoard } from './useMarkdownBoard';
import { fetchProjectDetails } from '../services/projectsApi';
import { clearProjectItemsApi, deleteItemApi, reorderItemsApi, replaceProjectItemsApi, updateItemApi } from '../services/itemsApi';
import type { MarkdownItem } from '../types/markdown';

vi.mock('../services/projectsApi', () => ({ fetchProjectDetails: vi.fn() }));
vi.mock('../services/itemsApi', () => ({
  createItemApi: vi.fn(), updateItemApi: vi.fn(), deleteItemApi: vi.fn(),
  reorderItemsApi: vi.fn(), clearProjectItemsApi: vi.fn(), replaceProjectItemsApi: vi.fn(),
}));
const items: MarkdownItem[] = ['a', 'b'].map((id, order) => ({
  id, projectId: 'p', content: id, order, createdAt: '2026-01-01', updatedAt: '2026-01-01',
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchProjectDetails).mockResolvedValue({ project: { id: 'p', name: 'P', order: 0, createdAt: '', updatedAt: '' }, items });
});
async function setup() {
  const hook = renderHook(() => useMarkdownBoard('p'));
  await waitFor(() => expect(hook.result.current.isLoading).toBe(false));
  return hook;
}

describe('persistência dos cards', () => {
  it.each(['edit', 'delete', 'clear', 'reorder'] as const)('preserva os cards se %s falhar', async (operation) => {
    const { result } = await setup();
    const error = new Error('offline');
    vi.mocked(updateItemApi).mockRejectedValue(error);
    vi.mocked(deleteItemApi).mockRejectedValue(error);
    vi.mocked(clearProjectItemsApi).mockRejectedValue(error);
    vi.mocked(reorderItemsApi).mockRejectedValue(error);
    await act(async () => {
      const request = operation === 'edit' ? result.current.updateItem('a', 'novo')
        : operation === 'delete' ? result.current.deleteItem('a')
        : operation === 'clear' ? result.current.clearItems()
        : result.current.reorderItems('a', 'b');
      await expect(request).rejects.toThrow('offline');
    });
    expect(result.current.items).toEqual(items);
  });

  it('substitui por uma única operação e mantém os IDs do backup', async () => {
    const { result } = await setup();
    vi.mocked(replaceProjectItemsApi).mockResolvedValue(items);
    await act(() => result.current.replaceItems(items));
    expect(replaceProjectItemsApi).toHaveBeenCalledWith('p', items);
    expect(clearProjectItemsApi).not.toHaveBeenCalled();
  });

  it('exibe falha de carregamento e permite tentar novamente', async () => {
    vi.mocked(fetchProjectDetails).mockRejectedValueOnce(new Error('offline'));
    const { result } = await setup();
    expect(result.current.loadError).toContain('Não foi possível');
    act(() => result.current.retryLoad());
    await waitFor(() => expect(result.current.items).toEqual(items));
    expect(result.current.loadError).toBeNull();
  });
});
