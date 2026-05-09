import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { db } from '../lib/db';
import {
  useDatabaseDiagram,
  type UseDatabaseDiagramResult,
} from './useDatabaseDiagram';

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
});
