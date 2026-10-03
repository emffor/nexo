import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { db } from '../lib/db';
import {
  useDatabaseDiagram,
  type UseDatabaseDiagramResult,
} from './useDatabaseDiagram';

// Exercise the hook against an isolated persistence adapter, never the live API.
vi.mock('../lib/databaseDiagramStore', async () => {
  const { db } = await import('../lib/db');
  const { DEFAULT_DATABASE_DBML } = await import('../types/database');
  return {
    getDatabaseDiagram: async () => (await db.databaseDiagrams.get('main')) ?? {
      id: 'main', title: 'Diagrama', content: DEFAULT_DATABASE_DBML,
      state: { positions: {} }, createdAt: '2026-01-01', updatedAt: '2026-01-01',
    },
    saveDatabaseDiagramRecord: async (patch: object) => {
      const next = { ...(await db.databaseDiagrams.get('main')), ...patch, id: 'main' };
      await db.databaseDiagrams.put(next as import('../types/database').DatabaseDiagramRecord);
      return next;
    },
    resetDatabaseDiagram: vi.fn(),
  };
});
vi.mock('../lib/projects', () => ({ touchProject: vi.fn().mockResolvedValue(undefined) }));

function Harness({
  onReady,
  onAutosaveError,
}: {
  onReady: (result: UseDatabaseDiagramResult) => void;
  onAutosaveError?: () => void;
}) {
  const result = useDatabaseDiagram({ onAutosaveError });

  useEffect(() => {
    onReady(result);
  }, [onReady, result]);

  return null;
}

describe('useDatabaseDiagram', () => {
  it('salva content e state juntos no autosave consolidado', async () => {
    let latest: UseDatabaseDiagramResult | undefined;
    const onAutosaveError = vi.fn();

    render(
      <Harness
        onReady={(result) => {
          latest = result;
        }}
        onAutosaveError={onAutosaveError}
      />,
    );

    await waitFor(() => expect(latest?.databaseDiagram).not.toBeNull());

    const nextContent = 'Table users { id integer [pk] }';
    const nextState = {
      positions: { users: { x: 120, y: 80 } },
    };

    act(() => {
      latest?.onDatabaseContentChange(nextContent);
      latest?.onDatabaseStateChange(nextState);
    });

    await waitFor(
      async () => {
        const saved = await db.databaseDiagrams.get('main');
        expect(saved?.content).toBe(nextContent);
        expect(saved?.state).toEqual(nextState);
      },
      { timeout: 1200 },
    );
    expect(onAutosaveError).not.toHaveBeenCalled();
  });

  it('mantem viewport salvo ao carregar diagrama', async () => {
    const savedViewport = { x: -180, y: 72, scale: 0.65 };
    await db.databaseDiagrams.put({
      id: 'main',
      title: 'Diagrama principal',
      content: 'Table users { id integer [pk] }',
      state: {
        positions: { users: { x: 120, y: 80 } },
        viewport: savedViewport,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    let latest: UseDatabaseDiagramResult | undefined;
    render(
      <Harness
        onReady={(result) => {
          latest = result;
        }}
      />,
    );

    await waitFor(() => {
      expect(latest?.databaseDiagram?.state.viewport).toEqual(savedViewport);
    });
  });
});

it('desfaz e refaz conteúdo, renomeação e posição de notas juntos', async () => {
  let latest: UseDatabaseDiagramResult | undefined;
  render(<Harness onReady={(result) => { latest = result; }} />);
  await waitFor(() => expect(latest?.databaseDiagram).not.toBeNull());
  act(() => latest?.onDatabaseContentChange('Table users { id integer [pk] }\nTableGroup vendas {\n users\n}'));
  await waitFor(() => expect(latest?.databaseDiagram?.state.positions.users).toBeDefined());
  act(() => latest?.onRenameDatabaseTable('users', 'clientes'));
  expect(latest?.databaseParseResult.groups[0].tables[0].name).toBe('clientes');
  act(() => latest?.undoDatabase());
  expect(latest?.databaseParseResult.tables[0].name).toBe('users');
  act(() => latest?.redoDatabase());
  expect(latest?.databaseParseResult.tables[0].name).toBe('clientes');
  act(() => latest?.onDatabaseStateChange({ ...latest.databaseDiagram!.state, notePositions: { lembrete: { x: 700, y: 80 } } }));
  act(() => latest?.undoDatabase());
  expect(latest?.databaseDiagram?.state.notePositions).toBeUndefined();
  act(() => latest?.redoDatabase());
  expect(latest?.databaseDiagram?.state.notePositions?.lembrete.x).toBe(700);
  await waitFor(async () => expect((await db.databaseDiagrams.get('main'))?.state.notePositions?.lembrete.x).toBe(700));
  act(() => latest?.undoDatabase());
  act(() => latest?.onDatabaseContentChange('Table nova { id integer }'));
  expect(latest?.canRedoDatabase).toBe(false);
});
