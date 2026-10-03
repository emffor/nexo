import type { DiagramStatus, MarkdownItem } from '../types/markdown';
import type { DiagramState } from '../types/diagram';
import type {
  DatabaseDiagramRecord,
  DatabaseRelationPathState,
  DatabaseDiagramVisualState,
  DatabaseTablePosition,
} from '../types/database';
import type { Project } from '../types/project';
import { normalizeMarkdownContent } from './items';

const VALID_STATUSES: DiagramStatus[] = [
  'backlog',
  'impedido',
  'em-desenvolvimento',
  'revisando',
  'finalizado',
];

function parseStatus(value: unknown): DiagramStatus | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  return (VALID_STATUSES as string[]).includes(value)
    ? (value as DiagramStatus)
    : undefined;
}

function parsePortSide(
  value: unknown,
): DiagramState['edges'][number]['fromPort'] {
  return value === 'top' ||
    value === 'right' ||
    value === 'bottom' ||
    value === 'left'
    ? value
    : undefined;
}

interface DatabaseDiagramBackupPayload {
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  state?: DatabaseDiagramVisualState;
}

interface MarkdownBackupFile {
  version: 1;
  exportedAt: string;
  items: MarkdownItem[];
  diagramState?: DiagramState;
  hiddenDiagramItemIds?: string[];
  databaseDiagram?: DatabaseDiagramBackupPayload;
}

interface ProjectBackupPayload {
  project: Project;
  items: MarkdownItem[];
  diagramState?: DiagramState;
  hiddenDiagramItemIds?: string[];
  databaseDiagram?: DatabaseDiagramBackupPayload;
}

interface CompleteProjectsBackupFile {
  version: 2;
  exportedAt: string;
  projects: ProjectBackupPayload[];
}

export interface ParsedBackupFile {
  items: MarkdownItem[];
  diagramState?: DiagramState;
  hiddenDiagramItemIds?: string[];
  databaseDiagram?: DatabaseDiagramRecord;
}

export interface ParsedProjectBackupFile extends ParsedBackupFile {
  project?: Partial<Project>;
}

export interface ParsedProjectsBackupFile {
  projects: ParsedProjectBackupFile[];
}

export interface ProjectBackupData {
  project: Project;
  items: MarkdownItem[];
  databaseDiagram?: DatabaseDiagramRecord;
}

function parseMarkdownItems(value: unknown): MarkdownItem[] {
  if (!Array.isArray(value)) {
    throw new Error('Arquivo de backup invalido.');
  }

  return value.map((item, index) => {
    if (
      !item ||
      typeof item !== 'object' ||
      typeof (item as { id?: unknown }).id !== 'string' ||
      typeof (item as { content?: unknown }).content !== 'string' ||
      typeof (item as { createdAt?: unknown }).createdAt !== 'string' ||
      typeof (item as { updatedAt?: unknown }).updatedAt !== 'string'
    ) {
      throw new Error('Arquivo de backup invalido.');
    }

    return {
      id: (item as { id: string }).id,
      title: typeof (item as { title?: unknown }).title === 'string' && (item as { title: string }).title.trim() ? (item as { title: string }).title.trim() : undefined,
      content: normalizeMarkdownContent((item as { content: string }).content),
      order: index,
      createdAt: (item as { createdAt: string }).createdAt,
      updatedAt: (item as { updatedAt: string }).updatedAt,
      status: parseStatus((item as { status?: unknown }).status),
      observation: typeof (item as { observation?: unknown }).observation === 'string' && (item as { observation: string }).observation.trim() ? (item as { observation: string }).observation.trim() : undefined,
    };
  });
}

function parseDiagramState(value: unknown): DiagramState | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const ds = value as Record<string, unknown>;
  const positions: Record<string, { x: number; y: number }> = {};
  const edges: DiagramState['edges'] = [];
  let viewport: DiagramState['viewport'];

  if (ds.positions && typeof ds.positions === 'object') {
    for (const [key, entry] of Object.entries(ds.positions)) {
      if (
        entry &&
        typeof entry === 'object' &&
        typeof (entry as { x: unknown }).x === 'number' &&
        typeof (entry as { y: unknown }).y === 'number'
      ) {
        positions[key] = {
          x: (entry as { x: number }).x,
          y: (entry as { y: number }).y,
        };
      }
    }
  }

  if (Array.isArray(ds.edges)) {
    for (const edge of ds.edges) {
      if (
        edge &&
        typeof edge === 'object' &&
        typeof (edge as { id: unknown }).id === 'string' &&
        typeof (edge as { from: unknown }).from === 'string' &&
        typeof (edge as { to: unknown }).to === 'string'
      ) {
        edges.push({
          id: (edge as { id: string }).id,
          from: (edge as { from: string }).from,
          to: (edge as { to: string }).to,
          fromPort: parsePortSide((edge as { fromPort?: unknown }).fromPort),
          toPort: parsePortSide((edge as { toPort?: unknown }).toPort),
        });
      }
    }
  }

  if (
    ds.viewport &&
    typeof ds.viewport === 'object' &&
    typeof (ds.viewport as { x: unknown }).x === 'number' &&
    typeof (ds.viewport as { y: unknown }).y === 'number' &&
    typeof (ds.viewport as { scale: unknown }).scale === 'number'
  ) {
    viewport = {
      x: (ds.viewport as { x: number }).x,
      y: (ds.viewport as { y: number }).y,
      scale: (ds.viewport as { scale: number }).scale,
    };
  }

  return { positions, edges, viewport };
}

function parseHiddenDiagramItemIds(
  value: unknown,
  items: MarkdownItem[],
): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const validItemIds = new Set(items.map((item) => item.id));
  return value.filter(
    (itemId): itemId is string =>
      typeof itemId === 'string' && validItemIds.has(itemId),
  );
}

function parseProject(value: unknown): Partial<Project> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  return {
    id: typeof raw.id === 'string' ? raw.id : undefined,
    name: typeof raw.name === 'string' ? raw.name : undefined,
    order: typeof raw.order === 'number' ? raw.order : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

function parseDatabaseVisualState(value: unknown): DatabaseDiagramVisualState | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const positions: Record<string, DatabaseTablePosition> = {};
  if (raw.positions && typeof raw.positions === 'object') {
    for (const [key, entry] of Object.entries(raw.positions)) {
      if (
        entry &&
        typeof entry === 'object' &&
        typeof (entry as { x: unknown }).x === 'number' &&
        typeof (entry as { y: unknown }).y === 'number'
      ) {
        positions[key] = {
          x: (entry as { x: number }).x,
          y: (entry as { y: number }).y,
        };
      }
    }
  }
  let viewport: DatabaseDiagramVisualState['viewport'];
  if (
    raw.viewport &&
    typeof raw.viewport === 'object' &&
    typeof (raw.viewport as { x: unknown }).x === 'number' &&
    typeof (raw.viewport as { y: unknown }).y === 'number' &&
    typeof (raw.viewport as { scale: unknown }).scale === 'number'
  ) {
    viewport = {
      x: (raw.viewport as { x: number }).x,
      y: (raw.viewport as { y: number }).y,
      scale: (raw.viewport as { scale: number }).scale,
    };
  }

  let relationPaths: DatabaseDiagramVisualState['relationPaths'];
  if (raw.relationPaths && typeof raw.relationPaths === 'object') {
    relationPaths = {};
    for (const [key, entry] of Object.entries(raw.relationPaths)) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }
      const path = entry as Record<string, unknown>;
      const fromSide = path.fromSide === 'left' || path.fromSide === 'right'
        ? path.fromSide
        : undefined;
      const toSide = path.toSide === 'left' || path.toSide === 'right'
        ? path.toSide
        : undefined;
      const points = Array.isArray(path.points)
        ? path.points.flatMap((point) => {
            if (
              point &&
              typeof point === 'object' &&
              typeof (point as { x: unknown }).x === 'number' &&
              typeof (point as { y: unknown }).y === 'number'
            ) {
              return [
                {
                  x: (point as { x: number }).x,
                  y: (point as { y: number }).y,
                },
              ];
            }
            return [];
          })
        : [];

      if (fromSide && toSide && points.length >= 2) {
        relationPaths[key] = {
          fromSide,
          toSide,
          points,
        } satisfies DatabaseRelationPathState;
      }
    }
  }

  let notePositions: DatabaseDiagramVisualState['notePositions'];
  if (raw.notePositions && typeof raw.notePositions === 'object') {
    notePositions = Object.fromEntries(Object.entries(raw.notePositions).flatMap(([key, entry]) => {
      if (!entry || typeof entry !== 'object') return [];
      const point = entry as Record<string, unknown>;
      return typeof point.x === 'number' && Number.isFinite(point.x) && typeof point.y === 'number' && Number.isFinite(point.y)
        ? [[key, { x: point.x, y: point.y }]] : [];
    }));
  }
  const collapsedGroups = Array.isArray(raw.collapsedGroups) ? raw.collapsedGroups.filter((name): name is string => typeof name === 'string') : undefined;
  return { positions, relationPaths, viewport, ...(collapsedGroups ? { collapsedGroups } : {}), ...(notePositions ? { notePositions } : {}) };
}

function parseDatabaseDiagram(
  value: unknown,
): DatabaseDiagramRecord | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  if (typeof raw.content !== 'string') {
    return undefined;
  }
  const now = new Date().toISOString();
  const state =
    parseDatabaseVisualState(raw.state) ?? { positions: {} };
  return {
    id: 'main',
    title: typeof raw.title === 'string' && raw.title.trim() ? raw.title : 'Diagrama principal',
    content: raw.content,
    state,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
  };
}

export function createBackupText(
  items: MarkdownItem[],
  diagramState?: DiagramState,
  hiddenDiagramItemIds?: string[],
  databaseDiagram?: DatabaseDiagramRecord | null,
): string {
  const payload: MarkdownBackupFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    items: items.map((item, index) => ({
      ...item,
      order: index,
    })),
    diagramState,
    hiddenDiagramItemIds,
    databaseDiagram: databaseDiagram
      ? {
          title: databaseDiagram.title,
          content: databaseDiagram.content,
          createdAt: databaseDiagram.createdAt,
          updatedAt: databaseDiagram.updatedAt,
          state: databaseDiagram.state,
        }
      : undefined,
  };

  return JSON.stringify(payload, null, 2);
}

function serializeDatabaseDiagram(
  databaseDiagram?: DatabaseDiagramRecord | null,
): DatabaseDiagramBackupPayload | undefined {
  return databaseDiagram
    ? {
        title: databaseDiagram.title,
        content: databaseDiagram.content,
        createdAt: databaseDiagram.createdAt,
        updatedAt: databaseDiagram.updatedAt,
        state: databaseDiagram.state,
      }
    : undefined;
}

export function createCompleteBackupText(projects: ProjectBackupData[]): string {
  const payload: CompleteProjectsBackupFile = {
    version: 2,
    exportedAt: new Date().toISOString(),
    projects: projects.map(({ project, items, databaseDiagram }) => ({
      project,
      items: items.map((item, index) => ({
        ...item,
        projectId: project.id,
        order: index,
      })),
      diagramState: project.diagramState,
      hiddenDiagramItemIds: project.hiddenDiagramItemIds,
      databaseDiagram: serializeDatabaseDiagram(databaseDiagram),
    })),
  };

  return JSON.stringify(payload, null, 2);
}

export function parseBackupFile(rawText: string): ParsedBackupFile {
  const parsed = JSON.parse(rawText) as Partial<MarkdownBackupFile>;

  if (parsed.version !== 1 || !Array.isArray(parsed.items)) {
    throw new Error('Arquivo de backup invalido.');
  }

  const items = parseMarkdownItems(parsed.items);
  const diagramState = parseDiagramState(parsed.diagramState);
  const hiddenDiagramItemIds = parseHiddenDiagramItemIds(
    parsed.hiddenDiagramItemIds,
    items,
  );

  const databaseDiagram = parseDatabaseDiagram(
    (parsed as { databaseDiagram?: unknown }).databaseDiagram,
  );

  return {
    items,
    diagramState,
    hiddenDiagramItemIds,
    databaseDiagram,
  };
}

export function parseProjectsBackupFile(
  rawText: string,
): ParsedProjectsBackupFile {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;

  if (parsed.version === 1) {
    return {
      projects: [parseBackupFile(rawText)],
    };
  }

  if (parsed.version !== 2 || !Array.isArray(parsed.projects)) {
    throw new Error('Arquivo de backup invalido.');
  }

  return {
    projects: parsed.projects.map((entry) => {
      if (!entry || typeof entry !== 'object') {
        throw new Error('Arquivo de backup invalido.');
      }

      const rawProject = entry as Record<string, unknown>;
      const items = parseMarkdownItems(rawProject.items);

      return {
        project: parseProject(rawProject.project),
        items,
        diagramState: parseDiagramState(rawProject.diagramState),
        hiddenDiagramItemIds: parseHiddenDiagramItemIds(
          rawProject.hiddenDiagramItemIds,
          items,
        ),
        databaseDiagram: parseDatabaseDiagram(rawProject.databaseDiagram),
      };
    }),
  };
}

export function parseBackupText(rawText: string): MarkdownItem[] {
  return parseBackupFile(rawText).items;
}
