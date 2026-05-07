import { describe, expect, it } from 'vitest';
import { buildCombinedContent, getCardTitle, reorderMarkdownItems } from './items';
import type { MarkdownItem } from '../types/markdown';

function createItem(id: string, order: number, content: string): MarkdownItem {
  return {
    id,
    order,
    content,
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:00:00.000Z',
  };
}

describe('items utilities', () => {
  it('concatena os textos na ordem recebida', () => {
    const content = buildCombinedContent([
      createItem('a', 0, '# Intro'),
      createItem('b', 1, '## Detalhes'),
      createItem('c', 2, '- Item'),
    ]);

    expect(content).toBe('# Intro\n\n## Detalhes\n\n- Item');
  });

  it('recalcula a ordem apos mover um card', () => {
    const reordered = reorderMarkdownItems(
      [
        createItem('a', 0, 'Primeiro'),
        createItem('b', 1, 'Segundo'),
        createItem('c', 2, 'Terceiro'),
      ],
      'c',
      'a',
    );

    expect(reordered.map((item) => item.id)).toEqual(['c', 'a', 'b']);
    expect(reordered.map((item) => item.order)).toEqual([0, 1, 2]);
  });

  it('usa a primeira linha nao vazia como titulo do card', () => {
    expect(getCardTitle('\n\n# Titulo principal\nTexto de apoio')).toBe('Titulo principal');
    expect(getCardTitle('   \n   ')).toBe('Sem titulo');
  });
});
