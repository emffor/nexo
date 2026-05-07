import { arrayMove } from '@dnd-kit/sortable';
import type { MarkdownItem } from '../types/markdown';

export function buildCombinedContent(items: Pick<MarkdownItem, 'content'>[]): string {
  return items.map((item) => item.content).join('\n\n');
}

export function normalizeMarkdownContent(content: string): string {
  return content
    .replace(/^ +/gm, '📌 ')
    .replace(/\u00a0/g, ' ');
}

function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

function stripMarkdownPrefix(line: string): string {
  return line.replace(/^#+\s+/, '').replace(/^\[.*?\]\s*/, '');
}

export function getCardTitle(content: string, maxLength = 72): string {
  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return 'Sem titulo';
  }

  const decoded = decodeHtmlEntities(firstLine);
  const clean = stripMarkdownPrefix(decoded).trim() || decoded;

  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, maxLength - 3)}...`;
}

export function reorderMarkdownItems(
  items: MarkdownItem[],
  activeId: string,
  overId: string,
): MarkdownItem[] {
  const oldIndex = items.findIndex((item) => item.id === activeId);
  const newIndex = items.findIndex((item) => item.id === overId);

  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return items;
  }

  const now = new Date().toISOString();

  return arrayMove(items, oldIndex, newIndex).map((item, index) => ({
    ...item,
    order: index,
    updatedAt: now,
  }));
}

export function getDisplayTitle(item: Pick<MarkdownItem, 'title' | 'content'>, maxLength = 72): string {
  if (item.title?.trim()) {
    const t = item.title.trim();
    return t.length <= maxLength ? t : `${t.slice(0, maxLength - 3)}...`;
  }
  return getCardTitle(item.content, maxLength);
}

export function isContentBlank(content: string): boolean {
  return content.trim().length === 0;
}
