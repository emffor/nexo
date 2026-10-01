import type {
  DatabaseDiagramRecord,
  DatabaseDiagramVisualState,
} from '../types/database';
import {
  fetchDatabaseDiagramApi,
  resetDatabaseDiagramApi,
  saveDatabaseDiagramApi,
} from '../services/databaseDiagramApi';

export async function getDatabaseDiagram(
  projectId = 'main'
): Promise<DatabaseDiagramRecord> {
  return fetchDatabaseDiagramApi(projectId);
}

export async function saveDatabaseDiagramRecord(
  record: Partial<DatabaseDiagramRecord> & { content: string },
  projectId = 'main'
): Promise<DatabaseDiagramRecord> {
  return saveDatabaseDiagramApi(projectId, record);
}

export async function saveDatabaseDiagramState(
  state: DatabaseDiagramVisualState,
  projectId = 'main'
): Promise<DatabaseDiagramRecord> {
  return saveDatabaseDiagramApi(projectId, { state });
}

export async function resetDatabaseDiagram(
  projectId = 'main'
): Promise<DatabaseDiagramRecord> {
  return resetDatabaseDiagramApi(projectId);
}
