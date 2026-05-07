import { describe, expect, it } from 'vitest';
import {
  createSequentialFlowLinks,
  extractFlowMetadata,
  getStatusVariant,
  sanitizeFlowLinks,
  toggleFlowLink,
} from './flow';
import type { FlowLink, MarkdownItem } from '../types/markdown';

function createItem(id: string, order: number, content: string): MarkdownItem {
  return {
    id,
    order,
    content,
    createdAt: '2026-04-04T00:00:00.000Z',
    updatedAt: '2026-04-04T00:00:00.000Z',
  };
}

describe('flow utilities', () => {
  it('extrai metadados simples do markdown', () => {
    const metadata = extractFlowMetadata(
      createItem(
        'a',
        0,
        '# Task A\n\nStatus: Em andamento\nPriority: Medium\nAssignee: Maria\nDev: Joao',
      ),
    );

    expect(metadata).toEqual({
      title: 'Task A',
      status: 'Em andamento',
      priority: 'Medium',
      assignee: 'Maria',
      dev: 'Joao',
    });
  });

  it('remove marcacao markdown dos valores extraidos', () => {
    const metadata = extractFlowMetadata(
      createItem(
        'a',
        0,
        '# Task A\n\n**Status:** **A iniciar**\n**Assignee:** **Nao atribuido**',
      ),
    );

    expect(metadata.status).toBe('A iniciar');
    expect(metadata.assignee).toBe('Nao atribuido');
  });

  it('mapeia status para variantes visuais', () => {
    expect(getStatusVariant('A iniciar')).toBe('backlog');
    expect(getStatusVariant('Em andamento')).toBe('progress');
    expect(getStatusVariant('Revisando')).toBe('review');
    expect(getStatusVariant('Finalizado')).toBe('done');
    expect(getStatusVariant('Impedido')).toBe('blocked');
    expect(getStatusVariant('Outro')).toBe('default');
  });

  it('gera links sequenciais pela ordem dos cards', () => {
    const links = createSequentialFlowLinks([
      createItem('a', 0, '# A'),
      createItem('b', 1, '# B'),
      createItem('c', 2, '# C'),
    ]);

    expect(links.map((link) => [link.sourceId, link.targetId])).toEqual([
      ['a', 'b'],
      ['b', 'c'],
    ]);
  });

  it('alterna criacao e remocao de links', () => {
    const created = toggleFlowLink([], 'a', 'b', '2026-04-04T00:00:00.000Z');
    const removed = toggleFlowLink(created, 'a', 'b', '2026-04-04T00:00:00.000Z');

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ sourceId: 'a', targetId: 'b' });
    expect(removed).toHaveLength(0);
  });

  it('remove links invalidos ou duplicados', () => {
    const links: FlowLink[] = [
      {
        id: '1',
        sourceId: 'a',
        targetId: 'b',
        createdAt: '2026-04-04T00:00:00.000Z',
        updatedAt: '2026-04-04T00:00:00.000Z',
      },
      {
        id: '2',
        sourceId: 'a',
        targetId: 'b',
        createdAt: '2026-04-04T00:00:00.000Z',
        updatedAt: '2026-04-04T00:00:00.000Z',
      },
      {
        id: '3',
        sourceId: 'a',
        targetId: 'x',
        createdAt: '2026-04-04T00:00:00.000Z',
        updatedAt: '2026-04-04T00:00:00.000Z',
      },
    ];

    expect(sanitizeFlowLinks(links, [createItem('a', 0, '# A'), createItem('b', 1, '# B')])).toEqual([
      links[0],
    ]);
  });
});
