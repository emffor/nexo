export type JiraCard = {
  title: string;
  content: string;
};

type AdfNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: AdfNode[];
};

export type JiraIssue = {
  key: string;
  fields: Record<string, unknown>;
  names?: Record<string, string>;
  schema?: Record<string, { type?: string; custom?: string }>;
};

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/([\\`*_{}\[\]()#+.!|~])/g, '\\$1');
}

function safeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return url.href.replace(/[()]/g, (char) => char === '(' ? '%28' : '%29');
  } catch {
    return undefined;
  }
}

function codeSpan(value: string): string {
  const longestRun = Math.max(0, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length));
  const fence = '`'.repeat(longestRun + 1);
  return `${fence} ${value} ${fence}`;
}

type JiraImage = { id: string; filename: string; url: string };

function renderNode(node: AdfNode, images: JiraImage[] = []): string {
  const children = () => (node.content ?? []).map((child) => renderNode(child, images)).join('');
  switch (node.type) {
    case 'text': {
      let text = escapeText(node.text ?? '');
      if (node.marks?.some((mark) => mark.type === 'code')) return codeSpan(node.text ?? '');
      for (const mark of node.marks ?? []) {
        if (mark.type === 'strong') text = text.replace(/^(\s*)(\S[\s\S]*?)(\s*)$/, '$1**$2**$3');
        if (mark.type === 'em') text = text.replace(/^(\s*)(\S[\s\S]*?)(\s*)$/, '$1*$2*$3');
        if (mark.type === 'strike') text = text.replace(/^(\s*)(\S[\s\S]*?)(\s*)$/, '$1~~$2~~$3');
        if (mark.type === 'link') {
          const url = safeUrl(mark.attrs?.href);
          if (url) text = `[${text}](${url})`;
        }
      }
      return text;
    }
    case 'paragraph': return `${children().replace(/^[ \t]+$/gm, '')}\n\n`;
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 2));
      return `${'#'.repeat(level)} ${children()}\n\n`;
    }
    case 'hardBreak': return '  \n';
    case 'rule': return '---\n\n';
    case 'codeBlock': {
      const text = (node.content ?? []).map((child) => child.text ?? '').join('');
      const longestRun = Math.max(2, ...Array.from(text.matchAll(/`+/g), (match) => match[0].length));
      const fence = '`'.repeat(longestRun + 1);
      const language = String(node.attrs?.language ?? '').replace(/[^a-zA-Z0-9_+-]/g, '');
      return `${fence}${language}\n${text}\n${fence}\n\n`;
    }
    case 'bulletList':
    case 'orderedList':
      return (node.content ?? []).map((item, index) => {
        const prefix = node.type === 'orderedList' ? `${Number(node.attrs?.order ?? 1) + index}. ` : '- ';
        return prefix + renderNode(item, images).trim().replace(/\n/g, `\n${' '.repeat(prefix.length)}`);
      }).join('\n') + '\n\n';
    case 'blockquote':
    case 'panel': return children().trim().split('\n').map((line) => `> ${line}`).join('\n') + '\n\n';
    case 'table': {
      const rows = (node.content ?? []).map((row) => (row.content ?? []).map((cell) =>
        renderNode(cell, images).trim().replace(/\n/g, ' ')));
      if (!rows.length) return '';
      const width = Math.max(...rows.map((row) => row.length));
      const format = (row: string[]) => `| ${Array.from({ length: width }, (_, index) => row[index] ?? '').join(' | ')} |`;
      return [format(rows[0]), format(Array(width).fill('---')), ...rows.slice(1).map(format)].join('\n') + '\n\n';
    }
    case 'mention': return escapeText(String(node.attrs?.text ?? 'Menção'));
    case 'emoji': return escapeText(String(node.attrs?.text ?? node.attrs?.shortName ?? ''));
    case 'status': return escapeText(String(node.attrs?.text ?? ''));
    case 'date': {
      const date = new Date(Number(node.attrs?.timestamp));
      return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
    }
    case 'inlineCard':
    case 'blockCard': {
      const url = safeUrl(node.attrs?.url);
      return url ? `[${escapeText(url)}](${url})` : '';
    }
    case 'media':
    case 'mediaInline': {
      const matches = images.filter((image) => image.id === node.attrs?.id || image.filename === node.attrs?.alt);
      if (matches.length === 1) {
        return `![${escapeText(matches[0].filename)}](${matches[0].url})\n\n`;
      }
      const url = safeUrl(node.attrs?.url);
      const label = escapeText(String(node.attrs?.alt ?? 'Mídia (consulte o Jira)'));
      return url ? `[${label}](${url})` : label;
    }
    case 'expand':
    case 'nestedExpand': return `**${escapeText(String(node.attrs?.title ?? 'Detalhes'))}**\n\n${children()}`;
    default: return children();
  }
}

export function adfToMarkdown(value: unknown, images: JiraImage[] = []): string {
  const node = record(value);
  if (typeof node.type !== 'string') return '';
  return renderNode(node as AdfNode, images).trim();
}

function fieldText(value: unknown, images: JiraImage[] = []): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return escapeText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map((item) => fieldText(item, images)).filter(Boolean).join(', ');
  const object = record(value);
  if (typeof object.type === 'string' && Array.isArray(object.content)) return adfToMarkdown(value, images);
  const label = object.displayName ?? object.name ?? object.value ?? object.key;
  if (label !== undefined) {
    const child = fieldText(object.child);
    return fieldText(label) + (child ? ` / ${child}` : '');
  }
  return '';
}

function dateText(value: unknown): string {
  if (typeof value !== 'string') return fieldText(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fieldText(value);
  const offset = value.match(/([+-])(\d{2}):?(\d{2})$/);
  const offsetMinutes = offset ? (Number(offset[2]) * 60 + Number(offset[3])) * (offset[1] === '-' ? -1 : 1) : 0;
  const localDate = new Date(date.getTime() + offsetMinutes * 60000);
  const timezone = offset ? `${offset[1]}${offset[2]}${offset[3]}` : '+0000';
  return escapeText(localDate.toUTCString().replace(/, 0(\d) /, ', $1 ').replace('GMT', timezone));
}

export function jiraIssueToMarkdown(issue: JiraIssue, baseUrl: string): JiraCard {
  const fields = issue.fields;
  const attachmentRecords = (Array.isArray(fields.attachment) ? fields.attachment : []).map(record);
  const images: JiraImage[] = attachmentRecords.filter((attachment) =>
    typeof attachment.id === 'string' && /^\d+$/.test(attachment.id)
    && /^(image\/(png|jpeg|gif|webp|avif|bmp))$/i.test(String(attachment.mimeType)))
    .map((attachment) => ({
      id: String(attachment.id),
      filename: String(attachment.filename ?? 'Imagem'),
      url: `/api/jira/attachments/${attachment.id}`,
    }));
  const issueUrl = `${baseUrl}/browse/${encodeURIComponent(issue.key)}`;
  const metadata = [
    ['Issue Key', issue.key], ['URL', issueUrl], ['Status', fields.status],
    ['Priority', fields.priority], ['Assignee', fields.assignee ?? 'Não atribuído'],
    ['Reporter', fields.reporter], ['Created', fields.created], ['Updated', fields.updated],
    ['Tipo', fields.issuetype], ['Resolução', fields.resolution], ['Labels', fields.labels],
    ['Componentes', fields.components], ['Versões', fields.fixVersions], ['Data limite', fields.duedate],
  ].map(([label, value]) => {
    const text = ['Created', 'Updated', 'Data limite'].includes(String(label)) ? dateText(value) : fieldText(value);
    return text ? `**${label}:** ${label === 'URL' ? `[${escapeText(issueUrl)}](${issueUrl})` : text}` : '';
  }).filter(Boolean).join('  \n');
  const parent = record(fields.parent);
  const customFieldLines = Object.entries(fields).filter(([key]) => key.startsWith('customfield_'))
    .map(([key, value]) => {
      const schema = issue.schema?.[key];
      if (schema?.custom === 'com.pyxis.greenhopper.jira:gh-lexo-rank'
        || schema?.custom === 'com.atlassian.jira.plugins.jira-development-integration-plugin:devsummarycf') return '';
      const text = schema?.type === 'date' || schema?.type === 'datetime' ? dateText(value)
        : schema?.custom === 'com.pyxis.greenhopper.jira:gh-epic-link' && value === parent.key
          ? fieldText(record(parent.fields).summary) || fieldText(value)
          : fieldText(value, images);
      return text ? `**${escapeText(issue.names?.[key] ?? key)}:** ${text}` : '';
    }).filter(Boolean);
  const customFields = customFieldLines.join(customFieldLines.some((line) => line.includes('\n')) ? '\n\n' : '  \n');
  const description = adfToMarkdown(fields.description, images) || fieldText(fields.description, images);
  const environment = adfToMarkdown(fields.environment, images) || fieldText(fields.environment, images);
  const attachments = attachmentRecords.map((attachment) => {
    const image = images.find((candidate) => candidate.id === attachment.id);
    if (image) {
      const alreadyEmbedded = [description, environment, customFields].some((section) => section.includes(`](${image.url})`));
      return alreadyEmbedded ? '' : `![${escapeText(image.filename)}](${image.url})`;
    }
    const url = safeUrl(attachment.content);
    return url ? `- [${escapeText(String(attachment.filename ?? 'Anexo'))}](${url})` : '';
  }).filter(Boolean).join('\n\n');
  const links = (Array.isArray(fields.issuelinks) ? fields.issuelinks : []).map((value) => {
    const link = record(value);
    const related = record(link.outwardIssue ?? link.inwardIssue);
    const type = record(link.type);
    if (typeof related.key !== 'string') return '';
    const relation = link.outwardIssue ? type.outward : type.inward;
    return `- ${fieldText(relation)}: [${escapeText(related.key)}](${baseUrl}/browse/${encodeURIComponent(related.key)}) ${fieldText(record(related.fields).summary)}`;
  }).filter(Boolean).join('\n');
  const content = [
    `# [${escapeText(issue.key)}] ${fieldText(fields.summary)}`, metadata,
    customFields ? `## Custom Fields\n\n${customFields}` : '',
    '---',
    description || '_Sem descrição._',
    environment ? `## Ambiente\n\n${environment}` : '',
    links ? `## Tasks relacionadas\n\n${links}` : '',
    attachments ? `## Anexos\n\n${attachments}` : '',
  ].filter(Boolean).join('\n\n');
  return { title: issue.key, content };
}
