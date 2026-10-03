import type { DiagramStatus, MarkdownItem } from '../types/markdown';

export async function createItemApi(data: {
  projectId: string;
  content: string;
  title?: string;
  id?: string;
  status?: DiagramStatus;
  observation?: string;
}): Promise<MarkdownItem> {
  const res = await fetch('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error('Falha ao criar item');
  }
  return res.json();
}
export async function createBatchItemsApi(
  projectId: string,
  batchItems: Array<{
    id?: string;
    content: string;
    title?: string;
    order?: number;
    status?: DiagramStatus;
    observation?: string;
  }>
): Promise<void> {
  const res = await fetch('/api/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, batchItems }),
  });
  if (!res.ok) {
    throw new Error('Falha ao criar itens em lote');
  }
}

export async function updateItemApi(
  id: string,
  patch: Partial<MarkdownItem>
): Promise<MarkdownItem> {
  const res = await fetch(`/api/items/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...patch,
      ...('status' in patch ? { status: patch.status ?? null } : {}),
      ...('observation' in patch ? { observation: patch.observation ?? null } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error('Falha ao atualizar item');
  }
  return res.json();
}

export async function deleteItemApi(id: string): Promise<void> {
  const res = await fetch(`/api/items/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Falha ao remover item');
  }
}

export async function reorderItemsApi(
  items: { id: string; order: number }[]
): Promise<void> {
  const res = await fetch('/api/items', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    throw new Error('Falha ao reordenar itens');
  }
}

export async function clearProjectItemsApi(projectId: string): Promise<void> {
  const res = await fetch('/api/items', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clearProjectId: projectId }),
  });
  if (!res.ok) {
    throw new Error('Falha ao limpar itens do projeto');
  }
}

export async function replaceProjectItemsApi(
  projectId: string,
  items: MarkdownItem[],
): Promise<MarkdownItem[]> {
  const res = await fetch('/api/items', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ replaceProjectId: projectId, items }),
  });
  if (!res.ok) throw new Error('Falha ao substituir os cards do projeto');
  return res.json();
}
