import { db } from './db';
import type { ParsedProjectBackupFile } from './backup';
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

function buildImportedProjectName(name?: string): string {
  const cleanName = name?.trim();
  if (cleanName) {
    return cleanName;
  }

  return `Projeto importado ${crypto.randomUUID().slice(0, 8)}`;
}

function remapDiagramState(
  diagramState: DiagramState | undefined,
  itemIdMap: Map<string, string>,
): DiagramState | undefined {
  if (!diagramState) {
    return undefined;
  }

  const positions: DiagramState['positions'] = {};
  for (const [itemId, position] of Object.entries(diagramState.positions)) {
    const nextItemId = itemIdMap.get(itemId);
    if (nextItemId) {
      positions[nextItemId] = position;
    }
  }

  const edges: DiagramState['edges'] = diagramState.edges.flatMap((edge) => {
    const from = itemIdMap.get(edge.from);
    const to = itemIdMap.get(edge.to);
    if (!from || !to) {
      return [];
    }

    return [
      {
        ...edge,
        id: crypto.randomUUID(),
        from,
        to,
      },
    ];
  });

  return {
    positions,
    edges,
    viewport: diagramState.viewport,
  };
}

function remapHiddenDiagramItemIds(
  hiddenDiagramItemIds: string[] | undefined,
  itemIdMap: Map<string, string>,
): string[] {
  if (!hiddenDiagramItemIds) {
    return [];
  }

  return hiddenDiagramItemIds.flatMap((itemId) => {
    const nextItemId = itemIdMap.get(itemId);
    return nextItemId ? [nextItemId] : [];
  });
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

export async function importProjectsBackup(
  importedProjects: ParsedProjectBackupFile[],
): Promise<Project[]> {
  const currentProjects = await ensureProjectsReady();
  const createdProjects: Project[] = [];
  const now = new Date().toISOString();

  await db.transaction(
    'rw',
    db.projects,
    db.items,
    db.databaseDiagrams,
    async () => {
      for (const [index, importedProject] of importedProjects.entries()) {
        const projectId = crypto.randomUUID();
        const itemIdMap = new Map<string, string>();
        const items: MarkdownItem[] = importedProject.items.map((item, order) => {
          const itemId = crypto.randomUUID();
          itemIdMap.set(item.id, itemId);

          return {
            ...item,
            id: itemId,
            projectId,
            order,
          };
        });
        const hiddenDiagramItemIds = remapHiddenDiagramItemIds(
          importedProject.hiddenDiagramItemIds,
          itemIdMap,
        );
        const project: Project = {
          id: projectId,
          name: normalizeProjectName(
            buildImportedProjectName(importedProject.project?.name),
          ),
          order: currentProjects.length + index,
          createdAt: importedProject.project?.createdAt ?? now,
          updatedAt: now,
          diagramState: remapDiagramState(
            importedProject.diagramState,
            itemIdMap,
          ),
          hiddenDiagramItemIds,
        };

        await db.projects.put(project);
        if (items.length > 0) {
          await db.items.bulkPut(items);
        }

        if (importedProject.databaseDiagram) {
          const databaseDiagram: DatabaseDiagramRecord = {
            ...importedProject.databaseDiagram,
            id: projectId,
            projectId,
          };
          await db.databaseDiagrams.put(databaseDiagram);
        }

        createdProjects.push(project);
      }
    },
  );

  return createdProjects;
}
