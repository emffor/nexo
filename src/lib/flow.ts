import type { FlowLink, MarkdownItem } from '../types/markdown';
import { getDisplayTitle } from './items';

export type FlowStatusVariant =
  | 'backlog'
  | 'blocked'
  | 'progress'
  | 'review'
  | 'done'
  | 'default';

export interface FlowMetadata {
  title: string;
  status?: string;
  priority?: string;
  assignee?: string;
  dev?: string;
}

const FIELD_ALIASES: Record<string, keyof Omit<FlowMetadata, 'title'>> = {
  status: 'status',
  priority: 'priority',
  assignee: 'assignee',
  dev: 'dev',
  desenvolvedor: 'dev',
};

function cleanMarkdownInlineValue(value: string): string {
  return value
    .trim()
    .replace(/^\*+/, '')
    .replace(/\*+$/, '')
    .replace(/^`(.+)`$/, '$1')
    .trim();
}

export function extractFlowMetadata(item: MarkdownItem): FlowMetadata {
  const metadata: FlowMetadata = {
    title: getDisplayTitle(item, 80),
  };

  item.content.split('\n').forEach((line) => {
    const cleanLine = line.trim().replace(/^[-*]\s+/, '');
    const match =
      cleanLine.match(/^\*\*([^*]+):\*\*\s*(.+)$/) ||
      cleanLine.match(/^([^:]+):\s*(.+)$/);

    if (!match) {
      return;
    }

    const key = cleanMarkdownInlineValue(match[1]).toLowerCase();
    const field = FIELD_ALIASES[key];

    if (!field || metadata[field]) {
      return;
    }

    metadata[field] = cleanMarkdownInlineValue(match[2]);
  });

  return metadata;
}

export function getStatusVariant(status?: string): FlowStatusVariant {
  const normalized = status
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (!normalized) {
    return 'default';
  }

  if (normalized.includes('impedido') || normalized.includes('blocked')) {
    return 'blocked';
  }

  if (
    normalized.includes('andamento') ||
    normalized.includes('desenvolvimento') ||
    normalized.includes('progress')
  ) {
    return 'progress';
  }

  if (
    normalized.includes('revis') ||
    normalized.includes('review') ||
    normalized.includes('validacao')
  ) {
    return 'review';
  }

  if (
    normalized.includes('finalizado') ||
    normalized.includes('done') ||
    normalized.includes('concluido')
  ) {
    return 'done';
  }

  if (
    normalized.includes('a iniciar') ||
    normalized.includes('backlog') ||
    normalized.includes('todo')
  ) {
    return 'backlog';
  }

  return 'default';
}

export function createSequentialFlowLinks(items: MarkdownItem[]): FlowLink[] {
  const timestamp = new Date(0).toISOString();

  return items.slice(0, -1).map((item, index) => {
    const target = items[index + 1];

    return {
      id: `default:${item.id}:${target.id}`,
      sourceId: item.id,
      targetId: target.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}

export function toggleFlowLink(
  links: FlowLink[],
  sourceId: string,
  targetId: string,
  now = new Date().toISOString(),
): FlowLink[] {
  if (sourceId === targetId) {
    return links;
  }

  const existingLink = links.find(
    (link) => link.sourceId === sourceId && link.targetId === targetId,
  );

  if (existingLink) {
    return links.filter((link) => link.id !== existingLink.id);
  }

  return [
    ...links,
    {
      id: crypto.randomUUID(),
      sourceId,
      targetId,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function sanitizeFlowLinks(
  links: FlowLink[],
  items: Pick<MarkdownItem, 'id'>[],
): FlowLink[] {
  const itemIds = new Set(items.map((item) => item.id));
  const seen = new Set<string>();

  return links.filter((link) => {
    const key = `${link.sourceId}:${link.targetId}`;

    if (
      link.sourceId === link.targetId ||
      !itemIds.has(link.sourceId) ||
      !itemIds.has(link.targetId) ||
      seen.has(key)
    ) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
