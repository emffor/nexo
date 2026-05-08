import type { DiagramNodePosition } from '../types/diagram';

export const DIAGRAM_NODE_WIDTH = 220;
export const DIAGRAM_NODE_HEIGHT = 130;
export const DIAGRAM_GRID_GAP_X = 80;
export const DIAGRAM_GRID_GAP_Y = 40;
export const DIAGRAM_GRID_OFFSET = 40;

export function computeAutoLayout(
  itemIds: string[],
  columns = 4,
): Record<string, DiagramNodePosition> {
  const result: Record<string, DiagramNodePosition> = {};
  const cols = Math.max(1, columns);

  itemIds.forEach((id, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    result[id] = {
      x: DIAGRAM_GRID_OFFSET + col * (DIAGRAM_NODE_WIDTH + DIAGRAM_GRID_GAP_X),
      y: DIAGRAM_GRID_OFFSET + row * (DIAGRAM_NODE_HEIGHT + DIAGRAM_GRID_GAP_Y),
    };
  });

  return result;
}

export function snapToGrid(value: number, step = 10): number {
  return Math.round(value / step) * step;
}
