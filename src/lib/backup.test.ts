import { describe, expect, it } from 'vitest';
import { createBackupText, parseBackupText } from './backup';
import type { MarkdownItem } from '../types/markdown';

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

describe('backup', () => {
  it('serializa e restaura cards em texto', () => {
    const rawText = createBackupText(items);
    const restored = parseBackupText(rawText);

    expect(restored).toEqual(items);
  });

  it('rejeita arquivo invalido', () => {
    expect(() => parseBackupText('{"version":2}')).toThrow(/arquivo de backup invalido/i);
  });
});
