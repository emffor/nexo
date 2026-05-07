import type { FlowLink, MarkdownItem } from '../types/markdown';
import { sanitizeFlowLinks } from './flow';
import { normalizeMarkdownContent } from './items';

interface MarkdownBackupFile {
  version: 1;
  exportedAt: string;
  items: MarkdownItem[];
  flowLinks?: FlowLink[];
  flowLinksCustomized?: boolean;
}

export interface ParsedBackupFile {
  items: MarkdownItem[];
  flowLinks: FlowLink[];
  flowLinksCustomized: boolean;
}

export function createBackupText(
  items: MarkdownItem[],
  flowLinks: FlowLink[] = [],
  flowLinksCustomized = false,
): string {
  const payload: MarkdownBackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    items: items.map((item, index) => ({
      ...item,
      order: index,
    })),
    flowLinks: sanitizeFlowLinks(flowLinks, items),
    flowLinksCustomized,
  };

  return JSON.stringify(payload, null, 2);
}

export function parseBackupFile(rawText: string): ParsedBackupFile {
  const parsed = JSON.parse(rawText) as Partial<MarkdownBackupFile>;

  if (parsed.version !== 1 || !Array.isArray(parsed.items)) {
    throw new Error('Arquivo de backup invalido.');
  }

  const items = parsed.items.map((item, index) => {
    if (
      !item ||
      typeof item.id !== 'string' ||
      typeof item.content !== 'string' ||
      typeof item.createdAt !== 'string' ||
      typeof item.updatedAt !== 'string'
    ) {
      throw new Error('Arquivo de backup invalido.');
    }

    return {
      id: item.id,
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : undefined,
      content: normalizeMarkdownContent(item.content),
      order: index,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  });

  const flowLinks = Array.isArray(parsed.flowLinks)
    ? sanitizeFlowLinks(
        parsed.flowLinks.map((link) => {
          if (
            !link ||
            typeof link.id !== 'string' ||
            typeof link.sourceId !== 'string' ||
            typeof link.targetId !== 'string' ||
            typeof link.createdAt !== 'string' ||
            typeof link.updatedAt !== 'string'
          ) {
            throw new Error('Arquivo de backup invalido.');
          }

          return {
            id: link.id,
            sourceId: link.sourceId,
            targetId: link.targetId,
            createdAt: link.createdAt,
            updatedAt: link.updatedAt,
          };
        }),
        items,
      )
    : [];

  return {
    items,
    flowLinks,
    flowLinksCustomized:
      parsed.flowLinksCustomized === true || flowLinks.length > 0,
  };
}

export function parseBackupText(rawText: string): MarkdownItem[] {
  return parseBackupFile(rawText).items;
}
