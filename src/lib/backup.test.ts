import { describe, expect, it } from 'vitest';
import { createBackupText, parseBackupFile, parseBackupText } from './backup';
import type { FlowLink, MarkdownItem } from '../types/markdown';

const items: MarkdownItem[] = [
  {
    id: '1',
    content: '# A',
    order: 0,
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:00:00.000Z',
  },
  {
    id: '2',
    content: '## B',
    order: 1,
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:00:00.000Z',
  },
];

const flowLinks: FlowLink[] = [
  {
    id: 'link-1',
    sourceId: '1',
    targetId: '2',
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:00:00.000Z',
  },
];

describe('backup', () => {
  it('serializa e restaura cards em texto', () => {
    const rawText = createBackupText(items);
    const restored = parseBackupText(rawText);

    expect(restored).toEqual(items);
  });

  it('serializa e restaura links do fluxo', () => {
    const rawText = createBackupText(items, flowLinks, true);
    const restored = parseBackupFile(rawText);

    expect(restored.items).toEqual(items);
    expect(restored.flowLinks).toEqual(flowLinks);
    expect(restored.flowLinksCustomized).toBe(true);
  });

  it('rejeita arquivo invalido', () => {
    expect(() => parseBackupText('{"version":2}')).toThrow(/arquivo de backup invalido/i);
  });
});
