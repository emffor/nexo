import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useDatabaseDiagram } from './useDatabaseDiagram';
import { getDatabaseDiagram, resetDatabaseDiagram, saveDatabaseDiagramRecord } from '../lib/databaseDiagramStore';
import type { DatabaseDiagramRecord } from '../types/database';

vi.mock('../lib/databaseDiagramStore', () => ({
  getDatabaseDiagram: vi.fn(), resetDatabaseDiagram: vi.fn(), saveDatabaseDiagramRecord: vi.fn(),
}));
vi.mock('../lib/projects', () => ({ touchProject: vi.fn().mockResolvedValue(undefined) }));
const record: DatabaseDiagramRecord = { id: 'p', projectId: 'p', title: 'Banco', content: '', state: { positions: {} }, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDatabaseDiagram).mockReset().mockResolvedValue(record);
  vi.mocked(saveDatabaseDiagramRecord).mockReset().mockResolvedValue(record);
  vi.mocked(resetDatabaseDiagram).mockReset().mockResolvedValue(record);
});

it('permite recuperar uma falha de carregamento sem rejeição não tratada', async () => {
  vi.mocked(getDatabaseDiagram).mockRejectedValueOnce(new Error('offline'));
  const { result } = renderHook(() => useDatabaseDiagram({ projectId: 'p' }));
  await waitFor(() => expect(result.current.databaseLoadError).toContain('Não foi possível'));
  act(() => result.current.retryDatabaseLoad());
  await waitFor(() => expect(result.current.databaseDiagram).toEqual(record));
  expect(result.current.databaseLoadError).toBeNull();
});

it('mantém snapshot que falhou disponível para nova tentativa ao sair da página', async () => {
  vi.mocked(saveDatabaseDiagramRecord).mockRejectedValueOnce(new Error('offline'));
  const { result } = renderHook(() => useDatabaseDiagram({ projectId: 'p' }));
  await waitFor(() => expect(result.current.databaseDiagram).not.toBeNull());
  act(() => result.current.onDatabaseContentChange('// alterado'));
  await waitFor(() => expect(result.current.databaseSaveStatus).toBe('error'));
  act(() => window.dispatchEvent(new Event('pagehide')));
  await waitFor(() => expect(result.current.databaseSaveStatus).toBe('saved'));
  expect(saveDatabaseDiagramRecord).toHaveBeenCalledTimes(2);
  expect(saveDatabaseDiagramRecord).toHaveBeenLastCalledWith(expect.objectContaining({ content: '// alterado' }), 'p');
});

it('aguarda autosave em andamento antes de restaurar o diagrama', async () => {
  let finish!: (value: DatabaseDiagramRecord) => void;
  vi.mocked(saveDatabaseDiagramRecord).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const { result } = renderHook(() => useDatabaseDiagram({ projectId: 'p' }));
  await waitFor(() => expect(result.current.databaseDiagram).not.toBeNull());
  act(() => result.current.onDatabaseContentChange('// pendente'));
  await waitFor(() => expect(saveDatabaseDiagramRecord).toHaveBeenCalledOnce());
  let reset!: Promise<DatabaseDiagramRecord>;
  act(() => { reset = result.current.resetDatabaseDiagramToDefault(); });
  expect(resetDatabaseDiagram).not.toHaveBeenCalled();
  await act(async () => { finish(record); await reset; });
  expect(resetDatabaseDiagram).toHaveBeenCalledWith('p');
});
