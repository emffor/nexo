import { describe, expect, it } from 'vitest';
import {
  createBackupText,
  createCompleteBackupText,
  parseBackupFile,
  parseBackupText,
} from './backup';
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

  it('preserva estado do diagrama no backup', () => {
    const rawText = createBackupText(items, {
      positions: { '1': { x: 100, y: 200 } },
      edges: [
        { id: 'e1', from: '1', to: '2', fromPort: 'bottom', toPort: 'top' },
      ],
      viewport: { x: -80, y: 40, scale: 0.8 },
    });

    const restored = parseBackupFile(rawText);

    expect(restored.diagramState).toEqual({
      positions: { '1': { x: 100, y: 200 } },
      edges: [
        { id: 'e1', from: '1', to: '2', fromPort: 'bottom', toPort: 'top' },
      ],
      viewport: { x: -80, y: 40, scale: 0.8 },
    });
  });

  it('preserva cards ocultos do diagrama no backup', () => {
    const rawText = createBackupText(items, undefined, ['2', 'inexistente']);
    const restored = parseBackupFile(rawText);

    expect(restored.hiddenDiagramItemIds).toEqual(['2']);
  });

  it('backup antigo sem databaseDiagram continua valido', () => {
    const rawText = createBackupText(items);
    const restored = parseBackupFile(rawText);
    expect(restored.databaseDiagram).toBeUndefined();
  });

  it('preserva diagrama de banco no round-trip', () => {
    const dbRecord = {
      id: 'main',
      title: 'Diagrama principal',
      content: 'Table users { id integer [pk] }',
      state: {
        positions: { users: { x: 50, y: 80 } },
        viewport: { x: 0, y: 0, scale: 1 },
      },
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
    };
    const rawText = createBackupText(items, undefined, undefined, dbRecord);
    const restored = parseBackupFile(rawText);

    expect(restored.databaseDiagram).toMatchObject({
      id: 'main',
      title: 'Diagrama principal',
      content: 'Table users { id integer [pk] }',
      state: {
        positions: { users: { x: 50, y: 80 } },
        viewport: { x: 0, y: 0, scale: 1 },
      },
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-02T00:00:00.000Z',
    });
  });

  it('ignora databaseDiagram inválido sem quebrar', () => {
    const rawText = JSON.stringify({
      version: 1,
      exportedAt: '2026-05-01T00:00:00.000Z',
      items,
      databaseDiagram: { foo: 'bar' },
    });
    const restored = parseBackupFile(rawText);
    expect(restored.items).toHaveLength(2);
    expect(restored.databaseDiagram).toBeUndefined();
  });

  it('serializa backup completo com multiplos projetos', () => {
    const rawText = createCompleteBackupText([
      {
        project: {
          id: 'project-a',
          name: 'Regularizacao',
          order: 0,
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-02T00:00:00.000Z',
          hiddenDiagramItemIds: ['2'],
        },
        items,
      },
      {
        project: {
          id: 'project-b',
          name: 'Doc Pronto',
          order: 1,
          createdAt: '2026-05-01T00:00:00.000Z',
          updatedAt: '2026-05-02T00:00:00.000Z',
        },
        items: [],
      },
    ]);
    const parsed = JSON.parse(rawText);

    expect(parsed.version).toBe(2);
    expect(parsed.projects).toHaveLength(2);
    expect(parsed.projects[0].project.name).toBe('Regularizacao');
    expect(parsed.projects[0].items[0].projectId).toBe('project-a');
    expect(parsed.projects[0].hiddenDiagramItemIds).toEqual(['2']);
  });
});
