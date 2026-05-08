import type {
  DatabaseDiagramVisualState,
  DatabaseTable,
  DatabaseTablePosition,
} from '../types/database';

export const DB_TABLE_WIDTH = 240;
export const DB_HEADER_HEIGHT = 32;
export const DB_ROW_HEIGHT = 26;
export const DB_TABLE_PADDING_BOTTOM = 8;
export const DB_GRID_OFFSET = 60;
export const DB_GRID_GAP_X = 80;
export const DB_GRID_GAP_Y = 60;

export function computeDatabaseTableHeight(columns: number): number {
  return DB_HEADER_HEIGHT + columns * DB_ROW_HEIGHT + DB_TABLE_PADDING_BOTTOM;
}

export function computeDatabaseAutoLayout(
  tables: DatabaseTable[],
  columnsPerRow = 3,
): Record<string, DatabaseTablePosition> {
  const positions: Record<string, DatabaseTablePosition> = {};
  let rowMaxHeight = 0;
  let cursorY = DB_GRID_OFFSET;

  tables.forEach((table, index) => {
    const col = index % columnsPerRow;
    const row = Math.floor(index / columnsPerRow);
    if (col === 0 && row > 0) {
      cursorY += rowMaxHeight + DB_GRID_GAP_Y;
      rowMaxHeight = 0;
    }
    const height = computeDatabaseTableHeight(table.columns.length);
    if (height > rowMaxHeight) {
      rowMaxHeight = height;
    }
    positions[table.id] = {
      x: DB_GRID_OFFSET + col * (DB_TABLE_WIDTH + DB_GRID_GAP_X),
      y: cursorY,
    };
  });

  return positions;
}

export function ensureTablePositions(
  tables: DatabaseTable[],
  current: DatabaseDiagramVisualState['positions'],
): DatabaseDiagramVisualState['positions'] {
  const missing = tables.filter((table) => !current[table.id]);
  if (missing.length === 0) {
    return current;
  }
  const next = { ...current };
  let cursorY = DB_GRID_OFFSET;
  // posicionar abaixo das existentes
  Object.values(current).forEach((pos) => {
    if (pos.y > cursorY) {
      cursorY = pos.y;
    }
  });
  cursorY += DB_GRID_GAP_Y;
  missing.forEach((table, idx) => {
    next[table.id] = {
      x: DB_GRID_OFFSET + (idx % 3) * (DB_TABLE_WIDTH + DB_GRID_GAP_X),
      y: cursorY + Math.floor(idx / 3) * (DB_GRID_GAP_Y + 200),
    };
  });
  return next;
}
