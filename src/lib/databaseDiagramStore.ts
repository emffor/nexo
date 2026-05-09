import { db } from './db';
import {
  DEFAULT_DATABASE_DBML,
  type DatabaseDiagramRecord,
  type DatabaseDiagramVisualState,
} from '../types/database';

const MAIN_ID = 'main';
const DEFAULT_TITLE = 'Diagrama principal';

export function buildDefaultDatabaseDiagram(): DatabaseDiagramRecord {
  const now = new Date().toISOString();
  return {
    id: MAIN_ID,
    title: DEFAULT_TITLE,
    content: DEFAULT_DATABASE_DBML,
    state: { positions: {}, viewport: { x: 0, y: 0, scale: 1 } },
    createdAt: now,
    updatedAt: now,
  };
}

async function saveDatabaseDiagramPatch(
  patch: Partial<DatabaseDiagramRecord>,
): Promise<DatabaseDiagramRecord> {
  return db.transaction('rw', db.databaseDiagrams, async () => {
    const existing =
      (await db.databaseDiagrams.get(MAIN_ID)) ?? buildDefaultDatabaseDiagram();
    const next: DatabaseDiagramRecord = {
      ...existing,
      ...patch,
      id: MAIN_ID,
      updatedAt: new Date().toISOString(),
    };
    await db.databaseDiagrams.put(next);
    return next;
  });
}

export async function getDatabaseDiagram(): Promise<DatabaseDiagramRecord> {
  const existing = await db.databaseDiagrams.get(MAIN_ID);
  if (existing) {
    const state = existing.state ?? { positions: {} };
    // Garante que o viewport padrão seja scale: 1 (100%)
    if (!state.viewport || state.viewport.scale !== 1) {
      state.viewport = { x: 0, y: 0, scale: 1 };
      await saveDatabaseDiagramPatch({ state });
    }
    return {
      ...existing,
      state,
    };
  }
  const fresh = buildDefaultDatabaseDiagram();
  await db.databaseDiagrams.put(fresh);
  return fresh;
}

export async function saveDatabaseDiagramContent(content: string): Promise<void> {
  await saveDatabaseDiagramPatch({ content });
}

export async function saveDatabaseDiagramState(
  state: DatabaseDiagramVisualState,
): Promise<void> {
  await saveDatabaseDiagramPatch({ state });
}

export async function saveDatabaseDiagramRecord(
  record: Partial<DatabaseDiagramRecord> & { content: string },
): Promise<DatabaseDiagramRecord> {
  return saveDatabaseDiagramPatch(record);
}

export async function clearDatabaseDiagram(): Promise<void> {
  await db.databaseDiagrams.delete(MAIN_ID);
}

export async function resetDatabaseDiagram(): Promise<DatabaseDiagramRecord> {
  const fresh = buildDefaultDatabaseDiagram();
  await db.databaseDiagrams.put(fresh);
  return fresh;
}
