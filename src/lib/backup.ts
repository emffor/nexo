import type { MarkdownItem } from '../types/markdown';
import { normalizeMarkdownContent } from './items';

interface MarkdownBackupFile {
  version: 1;
  exportedAt: string;
  items: MarkdownItem[];
}

export function createBackupText(items: MarkdownItem[]): string {
  const payload: MarkdownBackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    items: items.map((item, index) => ({
      ...item,
      order: index,
    })),
  };

  return JSON.stringify(payload, null, 2);
}

export function parseBackupText(rawText: string): MarkdownItem[] {
  const parsed = JSON.parse(rawText) as Partial<MarkdownBackupFile>;

  if (parsed.version !== 1 || !Array.isArray(parsed.items)) {
    throw new Error('Arquivo de backup invalido.');
  }

  return parsed.items.map((item, index) => {
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
}
