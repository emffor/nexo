import { db } from './db';
import type { DatabaseDiagramRecord } from '../types/database';
import type { DiagramState } from '../types/diagram';
import type { MarkdownItem } from '../types/markdown';
import type { Project } from '../types/project';

export const DEFAULT_PROJECT_ID = 'default-project';
export const DEFAULT_PROJECT_NAME = 'Meu primeiro projeto';

export interface ProjectSummary extends Project {
  itemsCount: number;
}

export interface ProjectData {
  project: Project;
  items: MarkdownItem[];
  databaseDiagram?: DatabaseDiagramRecord;
}

function buildDefaultProject(): Project {
  const now = new Date().toISOString();
  return {
    id: DEFAULT_PROJECT_ID,
    name: DEFAULT_PROJECT_NAME,
    order: 0,
    createdAt: now,
    updatedAt: now,
    hiddenDiagramItemIds: [],
  };
}

function normalizeProjectName(name: string): string {
  return name.trim() || 'Projeto sem nome';
}

export async function ensureProjectsReady(): Promise<Project[]> {
  await db.transaction(
    'rw',
    db.projects,
    db.items,
    db.databaseDiagrams,
    async () => {
      let projects = await db.projects.orderBy('order').toArray();

      if (projects.length === 0) {
        const hasLegacyData =
          (await db.items.count()) > 0 ||
          (await db.databaseDiagrams.count()) > 0;
        if (!hasLegacyData) {
          return;
        }
        const defaultProject = buildDefaultProject();
        await db.projects.put(defaultProject);
        projects = [defaultProject];
      }

      const targetProject = projects[0];
      const orphanItems = await db.items
        .filter((item) => !item.projectId)
        .toArray();

      if (orphanItems.length > 0) {
        await db.items.bulkPut(
          orphanItems.map((item) => ({
            ...item,
            projectId: targetProject.id,
          })),
        );
      }

      const legacyDatabaseDiagram = await db.databaseDiagrams.get('main');
      const targetDatabaseDiagram = await db.databaseDiagrams.get(
        targetProject.id,
      );

      if (legacyDatabaseDiagram && !targetDatabaseDiagram) {
        await db.databaseDiagrams.put({
          ...legacyDatabaseDiagram,
          id: targetProject.id,
          projectId: targetProject.id,
        });
        await db.databaseDiagrams.delete('main');
      }
    },
  );

  return db.projects.orderBy('order').toArray();
}

export async function getProjectSummaries(): Promise<ProjectSummary[]> {
  const projects = await ensureProjectsReady();
  const items = await db.items.toArray();
  const counts = new Map<string, number>();

  for (const item of items) {
    if (!item.projectId) {
      continue;
    }
    counts.set(item.projectId, (counts.get(item.projectId) ?? 0) + 1);
  }

  return projects.map((project) => ({
    ...project,
    itemsCount: counts.get(project.id) ?? 0,
  }));
}

export async function createProject(name: string): Promise<Project> {
  const projects = await ensureProjectsReady();
  const now = new Date().toISOString();
  const project: Project = {
    id: crypto.randomUUID(),
    name: normalizeProjectName(name),
    order: projects.length,
    createdAt: now,
    updatedAt: now,
    hiddenDiagramItemIds: [],
  };

  await db.projects.put(project);
  return project;
}

export async function renameProject(
  projectId: string,
  name: string,
): Promise<Project | null> {
  const current = await db.projects.get(projectId);
  if (!current) {
    return null;
  }

  const updated: Project = {
    ...current,
    name: normalizeProjectName(name),
    updatedAt: new Date().toISOString(),
  };

  await db.projects.put(updated);
  return updated;
}

export async function touchProject(projectId: string): Promise<void> {
  const current = await db.projects.get(projectId);
  if (!current) {
    return;
  }
  await db.projects.put({
    ...current,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateProjectDiagramState(
  projectId: string,
  diagramState: DiagramState,
): Promise<void> {
  const current = await db.projects.get(projectId);
  if (!current) {
    return;
  }
  await db.projects.put({
    ...current,
    diagramState,
    updatedAt: new Date().toISOString(),
  });
}

export async function updateProjectHiddenDiagramItemIds(
  projectId: string,
  hiddenDiagramItemIds: string[],
): Promise<void> {
  const current = await db.projects.get(projectId);
  if (!current) {
    return;
  }
  await db.projects.put({
    ...current,
    hiddenDiagramItemIds,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  await db.transaction(
    'rw',
    db.projects,
    db.items,
    db.databaseDiagrams,
    async () => {
      await db.projects.delete(projectId);
      await db.items.where('projectId').equals(projectId).delete();
      await db.databaseDiagrams.where('projectId').equals(projectId).delete();
      await db.databaseDiagrams.delete(projectId);
    },
  );
}

export async function getProjectData(
  projectId: string,
): Promise<ProjectData | null> {
  const project = await db.projects.get(projectId);
  if (!project) {
    return null;
  }

  const [items, databaseDiagram] = await Promise.all([
    db.items.where('projectId').equals(projectId).sortBy('order'),
    db.databaseDiagrams.get(projectId),
  ]);

  return { project, items, databaseDiagram };
}

export async function getAllProjectsData(): Promise<ProjectData[]> {
  const projects = await ensureProjectsReady();
  const data = await Promise.all(
    projects.map((project) => getProjectData(project.id)),
  );
  return data.filter(
    (projectData): projectData is ProjectData => projectData !== null,
  );
}
