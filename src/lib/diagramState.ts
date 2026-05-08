import type { DiagramEdge, DiagramState } from '../types/diagram';

const STORAGE_KEY = 'organizar-markdown:diagram-state';

const emptyState: DiagramState = {
  positions: {},
  edges: [],
};

function isValidEdge(value: unknown): value is DiagramEdge {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const edge = value as Record<string, unknown>;
  return (
    typeof edge.id === 'string' &&
    typeof edge.from === 'string' &&
    typeof edge.to === 'string'
  );
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
          typeof (value as { x: unknown }).x === 'number' &&
          typeof (value as { y: unknown }).y === 'number'
        ) {
          positions[key] = { x: (value as { x: number }).x, y: (value as { y: number }).y };
        }
      }
    }

    const edges: DiagramEdge[] = Array.isArray(parsed.edges)
      ? parsed.edges.filter(isValidEdge)
      : [];

    return { positions, edges };
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
