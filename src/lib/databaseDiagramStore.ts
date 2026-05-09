import { db } from './db';
import {
  DEFAULT_DATABASE_DBML,
  type DatabaseDiagramRecord,
  type DatabaseDiagramVisualState,
} from '../types/database';

const MAIN_ID = 'main';
const DEFAULT_TITLE = 'Diagrama principal';

export function buildDefaultDatabaseDiagram(
  projectId = MAIN_ID,
): DatabaseDiagramRecord {
  const now = new Date().toISOString();
  return {
    id: projectId,
    projectId,
    title: DEFAULT_TITLE,
    content: DEFAULT_DATABASE_DBML,
    state: { positions: {}, viewport: { x: 0, y: 0, scale: 1 } },
    createdAt: now,
    updatedAt: now,
  };
}

async function saveDatabaseDiagramPatch(
  projectId: string,
  patch: Partial<DatabaseDiagramRecord>,
): Promise<DatabaseDiagramRecord> {
  return db.transaction('rw', db.databaseDiagrams, async () => {
    const existing =
      (await db.databaseDiagrams.get(projectId)) ??
      buildDefaultDatabaseDiagram(projectId);
    const next: DatabaseDiagramRecord = {
      ...existing,
      ...patch,
      id: projectId,
      projectId,
      updatedAt: new Date().toISOString(),
    };
    await db.databaseDiagrams.put(next);
    return next;
  });
}

export async function getDatabaseDiagram(
  projectId = MAIN_ID,
): Promise<DatabaseDiagramRecord> {
  const existing = await db.databaseDiagrams.get(projectId);
  if (existing) {
    const state = existing.state ?? { positions: {} };
    return {
      ...existing,
      projectId,
      state,
    };
  }
  const fresh = buildDefaultDatabaseDiagram(projectId);
  await db.databaseDiagrams.put(fresh);
  return fresh;
}

export async function saveDatabaseDiagramContent(
  content: string,
  projectId = MAIN_ID,
): Promise<void> {
  await saveDatabaseDiagramPatch(projectId, { content });
}

export async function saveDatabaseDiagramState(
  state: DatabaseDiagramVisualState,
  projectId = MAIN_ID,
): Promise<void> {
  await saveDatabaseDiagramPatch(projectId, { state });
}

export async function saveDatabaseDiagramRecord(
  record: Partial<DatabaseDiagramRecord> & { content: string },
  projectId = MAIN_ID,
): Promise<DatabaseDiagramRecord> {
  return saveDatabaseDiagramPatch(projectId, record);
}

export async function clearDatabaseDiagram(projectId = MAIN_ID): Promise<void> {
  await db.databaseDiagrams.delete(projectId);
}

export async function resetDatabaseDiagram(
  projectId = MAIN_ID,
): Promise<DatabaseDiagramRecord> {
  const fresh = buildDefaultDatabaseDiagram(projectId);
  await db.databaseDiagrams.put(fresh);
  return fresh;
}
