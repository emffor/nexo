import { jiraIssueToMarkdown, type JiraCard, type JiraIssue } from '../lib/jiraMarkdown';
import { getJiraIssueKey } from '../lib/jiraIssueKey';

export class JiraImportError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'JiraImportError';
  }
}

function getJiraConfiguration() {
  const email = process.env.JIRA_EMAIL?.trim();
  const token = process.env.JIRA_API_TOKEN?.trim();
  const configuredUrl = process.env.JIRA_BASE_URL?.trim();
  if (!email || !token || !configuredUrl) {
    throw new JiraImportError('Configure JIRA_BASE_URL, JIRA_EMAIL e JIRA_API_TOKEN no servidor.', 503);
  }
  let url: URL;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new JiraImportError('JIRA_BASE_URL inválida no servidor.', 503);
  }
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.atlassian\.net$/i.test(url.hostname)
    || url.username || url.password || url.port || !['', '/'].includes(url.pathname) || url.search || url.hash) {
    throw new JiraImportError('JIRA_BASE_URL deve ser a URL HTTPS do seu site Jira Cloud (*.atlassian.net).', 503);
  }
  return { baseUrl: url.origin, email, token };
}

async function fetchJira(path: string, accept = 'application/json'): Promise<{ response: Response; baseUrl: string }> {
  const { baseUrl, email, token } = getJiraConfiguration();
  const url = new URL(`${baseUrl}${path}`);
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: accept,
        Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
      },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new JiraImportError('Não foi possível conectar ao Jira. Tente novamente.', 502);
  }
  if (!response.ok) {
    if (response.status === 404) throw new JiraImportError('Task não encontrada ou sem permissão de acesso no Jira.', 404);
    if (response.status === 401 || response.status === 403) {
      throw new JiraImportError('O Jira recusou o acesso. Verifique as credenciais e permissões da integração.', 502);
    }
    if (response.status === 429) throw new JiraImportError('Limite de consultas do Jira atingido. Aguarde e tente novamente.', 429);
    throw new JiraImportError('Falha ao consultar o Jira. Tente novamente.', 502);
  }
  return { response, baseUrl };
}

export async function getJiraAttachment(id: string): Promise<{ content: ArrayBuffer; contentType: string }> {
  if (!/^\d+$/.test(id)) throw new JiraImportError('Identificador de anexo inválido.', 400);
  const { response } = await fetchJira(`/rest/api/3/attachment/content/${id}?redirect=false`, '*/*');
  const contentType = (response.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
  if (!/^image\/(png|jpeg|gif|webp|avif|bmp)$/.test(contentType)) {
    throw new JiraImportError('O anexo não é uma imagem compatível.', 415);
  }
  const maxSize = 20 * 1024 * 1024;
  if (Number(response.headers.get('Content-Length')) > maxSize) {
    throw new JiraImportError('A imagem excede o limite de 20 MB.', 413);
  }
  try {
    const content = await response.arrayBuffer();
    if (content.byteLength > maxSize) throw new JiraImportError('A imagem excede o limite de 20 MB.', 413);
    return { content, contentType };
  } catch (error) {
    if (error instanceof JiraImportError) throw error;
    throw new JiraImportError('Falha ao carregar imagem do Jira.', 502);
  }
}

export async function importJiraIssue(input: string): Promise<JiraCard> {
  const key = getJiraIssueKey(input);
  if (!key || key !== input.toUpperCase()) {
    throw new JiraImportError('Informe uma chave válida, como P2M-1185.', 400);
  }
  const { response, baseUrl } = await fetchJira(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=*all&expand=names,schema`);
  let issue: JiraIssue;
  try {
    issue = await response.json();
    if (typeof issue.key !== 'string' || !/^[A-Z][A-Z0-9_]*-\d+$/.test(issue.key)
      || !issue.fields || typeof issue.fields !== 'object' || Array.isArray(issue.fields)
      || typeof issue.fields.summary !== 'string') throw new Error('Invalid issue');
    return jiraIssueToMarkdown(issue, baseUrl);
  } catch {
    throw new JiraImportError('O Jira retornou uma task em formato inválido.', 502);
  }
}
