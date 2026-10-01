import type { ParsedProjectBackupFile } from './backup';
import type { DatabaseDiagramRecord } from '../types/database';
import type { DiagramState } from '../types/diagram';
import type { MarkdownItem } from '../types/markdown';
import type { Project } from '../types/project';
import {
  fetchProjects,
  createProjectApi,
  fetchProjectDetails,
  updateProjectApi,
  deleteProjectApi,
} from '../services/projectsApi';
import { clearProjectItemsApi, createItemApi, createBatchItemsApi } from '../services/itemsApi';
import { saveDatabaseDiagramApi } from '../services/databaseDiagramApi';

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

let ensureProjectsPromise: Promise<Project[]> | null = null;

export async function ensureProjectsReady(): Promise<Project[]> {
  if (ensureProjectsPromise) {
    return ensureProjectsPromise;
  }

  ensureProjectsPromise = (async () => {
    try {
      const projects = await fetchProjects();
      if (projects.length === 0) {
        const created = await createProjectApi(DEFAULT_PROJECT_NAME, DEFAULT_PROJECT_ID);
        return [created];
      }
      return projects;
    } finally {
      ensureProjectsPromise = null;
    }
  })();

  return ensureProjectsPromise;
}

export async function getProjectSummaries(): Promise<ProjectSummary[]> {
  const projects = await ensureProjectsReady();
  return projects as ProjectSummary[];
}

export async function createProject(name: string): Promise<Project> {
  const project = await createProjectApi(normalizeProjectName(name));
  return project;
}

export async function renameProject(
  projectId: string,
  name: string,
): Promise<Project | null> {
  const updated = await updateProjectApi(projectId, {
    name: normalizeProjectName(name),
  });
  return updated;
}

export async function touchProject(projectId: string): Promise<void> {
  try {
    await updateProjectApi(projectId, {});
  } catch (e) {
    // Silencia em touch para não bloquear UI
  }
}

export async function updateProjectDiagramState(
  projectId: string,
  diagramState: DiagramState,
): Promise<void> {
  await updateProjectApi(projectId, { diagramState });
}

export async function updateProjectHiddenDiagramItemIds(
  projectId: string,
  hiddenDiagramItemIds: string[],
): Promise<void> {
  await updateProjectApi(projectId, { hiddenDiagramItemIds });
}

export async function deleteProject(projectId: string): Promise<void> {
  await deleteProjectApi(projectId);
}

export async function getProjectData(
  projectId: string,
): Promise<ProjectData | null> {
  try {
    const details = await fetchProjectDetails(projectId);
    return details;
  } catch {
    return null;
  }
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
  const createdProjects: Project[] = [];

  for (const importedProject of importedProjects) {
    const projectName = normalizeProjectName(
      buildImportedProjectName(importedProject.project?.name),
    );
    const created = await createProjectApi(projectName);
    const projectId = created.id;
    const itemIdMap = new Map<string, string>();
    const batchItems = importedProject.items.map((item, order) => {
      const itemId = crypto.randomUUID();
      itemIdMap.set(item.id, itemId);

      return {
        id: itemId,
        projectId,
        content: item.content,
        title: item.title,
        order,
        status: item.status,
        observation: item.observation,
      };
    });

    if (batchItems.length > 0) {
      await createBatchItemsApi(projectId, batchItems);
    }

    const hiddenDiagramItemIds = remapHiddenDiagramItemIds(
      importedProject.hiddenDiagramItemIds,
      itemIdMap,
    );
    const diagramState = remapDiagramState(
      importedProject.diagramState,
      itemIdMap,
    );

    await updateProjectApi(projectId, {
      diagramState,
      hiddenDiagramItemIds,
    });

    if (importedProject.databaseDiagram) {
      await saveDatabaseDiagramApi(projectId, {
        title: importedProject.databaseDiagram.title,
        content: importedProject.databaseDiagram.content,
        state: importedProject.databaseDiagram.state,
      });
    }

    createdProjects.push(created);
  }

  return createdProjects;
}
