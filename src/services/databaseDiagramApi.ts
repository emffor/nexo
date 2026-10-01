import type { DatabaseDiagramRecord } from '../types/database';

export async function fetchDatabaseDiagramApi(
  projectId: string
): Promise<DatabaseDiagramRecord> {
  const res = await fetch(`/api/diagrams/${projectId}`);
  if (!res.ok) {
    throw new Error('Falha ao obter diagrama');
  }
  return res.json();
}

export async function saveDatabaseDiagramApi(
  projectId: string,
  patch: Partial<DatabaseDiagramRecord>
): Promise<DatabaseDiagramRecord> {
  const res = await fetch(`/api/diagrams/${projectId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error('Falha ao salvar diagrama');
  }
  return res.json();
}

export async function resetDatabaseDiagramApi(
  projectId: string
): Promise<DatabaseDiagramRecord> {
  const res = await fetch(`/api/diagrams/${projectId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Falha ao resetar diagrama');
  }
  return res.json();
}
