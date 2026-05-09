import type {
  DiagramEdge,
  DiagramPortSide,
  DiagramState,
  DiagramViewport,
} from '../types/diagram';

const STORAGE_KEY = 'organizar-markdown:diagram-state';

const emptyState: DiagramState = {
  positions: {},
  edges: [],
};

function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parsePortSide(value: unknown): DiagramPortSide | undefined {
  return value === 'top' ||
    value === 'right' ||
    value === 'bottom' ||
    value === 'left'
    ? value
    : undefined;
}

function isValidEdge(value: unknown): value is DiagramEdge {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const edge = value as unknown as Record<string, unknown>;
  return (
    typeof edge.id === 'string' &&
    typeof edge.from === 'string' &&
    typeof edge.to === 'string'
  );
}

function parseEdge(value: unknown): DiagramEdge | undefined {
  if (!isValidEdge(value)) {
    return undefined;
  }

  const edge = value as unknown as Record<string, unknown>;
  return {
    id: value.id,
    from: value.from,
    to: value.to,
    fromPort: parsePortSide(edge.fromPort),
    toPort: parsePortSide(edge.toPort),
  };
}

function parseViewport(value: unknown): DiagramViewport | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const viewport = value as Record<string, unknown>;
  if (
    !isValidNumber(viewport.x) ||
    !isValidNumber(viewport.y) ||
    !isValidNumber(viewport.scale)
  ) {
    return undefined;
  }

  return {
    x: viewport.x,
    y: viewport.y,
    scale: viewport.scale,
  };
}

export function readDiagramState(): DiagramState {
  if (typeof window === 'undefined') {
    return { ...emptyState };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { ...emptyState };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DiagramState>;
    const positions: DiagramState['positions'] = {};

    if (parsed.positions && typeof parsed.positions === 'object') {
      for (const [key, value] of Object.entries(parsed.positions)) {
        if (
          value &&
          typeof value === 'object' &&
          isValidNumber((value as { x: unknown }).x) &&
          isValidNumber((value as { y: unknown }).y)
        ) {
          positions[key] = { x: (value as { x: number }).x, y: (value as { y: number }).y };
        }
      }
    }

    const edges: DiagramEdge[] = Array.isArray(parsed.edges)
      ? parsed.edges.flatMap((edge) => {
          const parsedEdge = parseEdge(edge);
          return parsedEdge ? [parsedEdge] : [];
        })
      : [];
    const viewport = parseViewport(parsed.viewport);

    // Garante que o viewport padrão seja scale: 1 (100%)
    if (!viewport || viewport.scale !== 1) {
      return { positions, edges, viewport: { x: 0, y: 0, scale: 1 } };
    }

    return { positions, edges, viewport };
  } catch {
    return { ...emptyState };
  }
}

export function writeDiagramState(state: DiagramState): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearDiagramState(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}
