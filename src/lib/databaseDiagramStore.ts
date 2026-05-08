import { db } from './db';
import {
  DEFAULT_DATABASE_DBML,
  type DatabaseDiagramRecord,
  type DatabaseDiagramVisualState,
} from '../types/database';

const MAIN_ID = 'main';
const DEFAULT_TITLE = 'Diagrama principal';

function buildDefault(): DatabaseDiagramRecord {
  const now = new Date().toISOString();
  return {
    id: MAIN_ID,
    title: DEFAULT_TITLE,
    content: DEFAULT_DATABASE_DBML,
    state: { positions: {} },
    createdAt: now,
    updatedAt: now,
  };
}

export async function getDatabaseDiagram(): Promise<DatabaseDiagramRecord> {
  const existing = await db.databaseDiagrams.get(MAIN_ID);
  if (existing) {
    return {
      ...existing,
      state: existing.state ?? { positions: {} },
    };
  }
  const fresh = buildDefault();
  await db.databaseDiagrams.put(fresh);
  return fresh;
}

export async function saveDatabaseDiagramContent(content: string): Promise<void> {
  const existing = (await db.databaseDiagrams.get(MAIN_ID)) ?? buildDefault();
  const next: DatabaseDiagramRecord = {
    ...existing,
    content,
    updatedAt: new Date().toISOString(),
  };
  await db.databaseDiagrams.put(next);
}

export async function saveDatabaseDiagramState(
  state: DatabaseDiagramVisualState,
): Promise<void> {
  const existing = (await db.databaseDiagrams.get(MAIN_ID)) ?? buildDefault();
  const next: DatabaseDiagramRecord = {
    ...existing,
    state,
    updatedAt: new Date().toISOString(),
  };
  await db.databaseDiagrams.put(next);
}

export async function saveDatabaseDiagramRecord(
  record: Partial<DatabaseDiagramRecord> & { content: string },
): Promise<DatabaseDiagramRecord> {
  const existing = (await db.databaseDiagrams.get(MAIN_ID)) ?? buildDefault();
  const next: DatabaseDiagramRecord = {
    ...existing,
    ...record,
    id: MAIN_ID,
    updatedAt: new Date().toISOString(),
  };
  await db.databaseDiagrams.put(next);
  return next;
}

export async function clearDatabaseDiagram(): Promise<void> {
  await db.databaseDiagrams.delete(MAIN_ID);
}
