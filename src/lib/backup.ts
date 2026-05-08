import type { DiagramStatus, MarkdownItem } from '../types/markdown';
import type { DiagramState } from '../types/diagram';
import type {
  DatabaseDiagramRecord,
  DatabaseDiagramVisualState,
  DatabaseTablePosition,
} from '../types/database';
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

export interface ParsedBackupFile {
  items: MarkdownItem[];
  diagramState?: DiagramState;
  hiddenDiagramItemIds?: string[];
  databaseDiagram?: DatabaseDiagramRecord;
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
  return { positions, viewport };
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

export function parseBackupFile(rawText: string): ParsedBackupFile {
  const parsed = JSON.parse(rawText) as Partial<MarkdownBackupFile>;

  if (parsed.version !== 1 || !Array.isArray(parsed.items)) {
    throw new Error('Arquivo de backup invalido.');
  }

  const items = parsed.items.map((item, index) => {
    if (
      !item ||
      typeof item.id !== 'string' ||
      typeof item.content !== 'string' ||
      typeof item.createdAt !== 'string' ||
      typeof item.updatedAt !== 'string'
    ) {
      throw new Error('Arquivo de backup invalido.');
    }

    return {
      id: item.id,
      title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : undefined,
      content: normalizeMarkdownContent(item.content),
      order: index,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      status: parseStatus((item as { status?: unknown }).status),
      observation: typeof (item as { observation?: unknown }).observation === 'string' && (item as { observation: string }).observation.trim() ? (item as { observation: string }).observation.trim() : undefined,
    };
  });

  let diagramState: DiagramState | undefined;
  let hiddenDiagramItemIds: string[] | undefined;

  if (parsed.diagramState && typeof parsed.diagramState === 'object') {
    const ds = parsed.diagramState as unknown as Record<string, unknown>;
    const positions: Record<string, { x: number; y: number }> = {};
    const edges: DiagramState['edges'] = [];
    let viewport: DiagramState['viewport'];

    if (ds.positions && typeof ds.positions === 'object') {
      for (const [key, value] of Object.entries(ds.positions)) {
        if (
          value &&
          typeof value === 'object' &&
          typeof (value as { x: unknown }).x === 'number' &&
          typeof (value as { y: unknown }).y === 'number'
        ) {
          positions[key] = {
            x: (value as { x: number }).x,
            y: (value as { y: number }).y,
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

    diagramState = { positions, edges, viewport };
  }

  if (Array.isArray(parsed.hiddenDiagramItemIds)) {
    const validItemIds = new Set(items.map((item) => item.id));
    hiddenDiagramItemIds = parsed.hiddenDiagramItemIds.filter(
      (itemId): itemId is string =>
        typeof itemId === 'string' && validItemIds.has(itemId),
    );
  }

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

export function parseBackupText(rawText: string): MarkdownItem[] {
  return parseBackupFile(rawText).items;
}
