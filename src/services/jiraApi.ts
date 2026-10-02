import type { JiraCard } from '../lib/jiraMarkdown';

export async function getJiraCardApi(key: string, signal?: AbortSignal): Promise<JiraCard> {
  const response = await fetch(`/api/jira/issues/${encodeURIComponent(key)}`, {
    signal,
    cache: 'no-store',
  });
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('A consulta ao Jira retornou uma resposta inválida. Verifique se a rota da integração está disponível.');
  }
  if (!data || typeof data !== 'object') {
    throw new Error('A consulta ao Jira retornou uma resposta inválida.');
  }
  if (!response.ok) {
    throw new Error('error' in data && typeof data.error === 'string' ? data.error : 'Falha ao buscar task no Jira.');
  }
  if (!('title' in data) || typeof data.title !== 'string' || !('content' in data) || typeof data.content !== 'string') {
    throw new Error('O Jira retornou uma resposta inválida.');
  }
  return { title: data.title, content: data.content };
}
