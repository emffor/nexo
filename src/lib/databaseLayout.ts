import type {
  DatabaseRelation,
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

export type DatabaseAutoLayoutAlgorithm =
  | 'left-right'
  | 'snowflake'
  | 'compact';

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

function sortTablesByName(tables: DatabaseTable[]): DatabaseTable[] {
  return [...tables].sort((a, b) => a.name.localeCompare(b.name));
}

function getTableHeight(table: DatabaseTable): number {
  return computeDatabaseTableHeight(table.columns.length);
}

function computeCompactLayout(
  tables: DatabaseTable[],
): Record<string, DatabaseTablePosition> {
  const columnsPerRow = Math.max(1, Math.ceil(Math.sqrt(tables.length)));
  return computeDatabaseAutoLayout(sortTablesByName(tables), columnsPerRow);
}

function computeLeftRightLayout(
  tables: DatabaseTable[],
  relations: DatabaseRelation[],
): Record<string, DatabaseTablePosition> {
  const tableIds = new Set(tables.map((table) => table.id));
  const tableById = new Map(tables.map((table) => [table.id, table]));
  const outgoing = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  tables.forEach((table) => {
    outgoing.set(table.id, []);
    incomingCount.set(table.id, 0);
  });

  relations.forEach((relation) => {
    if (!tableIds.has(relation.fromTable) || !tableIds.has(relation.toTable)) {
      return;
    }
    outgoing.get(relation.fromTable)?.push(relation.toTable);
    incomingCount.set(
      relation.toTable,
      (incomingCount.get(relation.toTable) ?? 0) + 1,
    );
  });

  const levels = new Map(tables.map((table) => [table.id, 0]));
  const queue = sortTablesByName(tables)
    .filter((table) => (incomingCount.get(table.id) ?? 0) === 0)
    .map((table) => table.id);
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) {
      continue;
    }
    visited.add(currentId);

    const currentLevel = levels.get(currentId) ?? 0;
    for (const nextId of outgoing.get(currentId) ?? []) {
      levels.set(nextId, Math.max(levels.get(nextId) ?? 0, currentLevel + 1));
      incomingCount.set(nextId, (incomingCount.get(nextId) ?? 0) - 1);
      if ((incomingCount.get(nextId) ?? 0) === 0) {
        queue.push(nextId);
      }
    }
  }

  if (visited.size < tables.length) {
    sortTablesByName(tables).forEach((table) => {
      if (!visited.has(table.id)) {
        levels.set(table.id, levels.get(table.id) ?? 0);
      }
    });
  }

  const groups = new Map<number, DatabaseTable[]>();
  sortTablesByName(tables).forEach((table) => {
    const level = levels.get(table.id) ?? 0;
    groups.set(level, [...(groups.get(level) ?? []), table]);
  });

  const positions: Record<string, DatabaseTablePosition> = {};
  [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .forEach(([level, levelTables]) => {
      let cursorY = DB_GRID_OFFSET;
      levelTables.forEach((table) => {
        positions[table.id] = {
          x: DB_GRID_OFFSET + level * (DB_TABLE_WIDTH + DB_GRID_GAP_X),
          y: cursorY,
        };
        cursorY +=
          getTableHeight(tableById.get(table.id) ?? table) + DB_GRID_GAP_Y;
      });
    });

  return positions;
}

function computeSnowflakeLayout(
  tables: DatabaseTable[],
  relations: DatabaseRelation[],
): Record<string, DatabaseTablePosition> {
  if (tables.length === 0) {
    return {};
  }

  const degree = new Map(tables.map((table) => [table.id, 0]));
  const referencedBy = new Map(tables.map((table) => [table.id, 0]));
  relations.forEach((relation) => {
    degree.set(relation.fromTable, (degree.get(relation.fromTable) ?? 0) + 1);
    degree.set(relation.toTable, (degree.get(relation.toTable) ?? 0) + 1);
    referencedBy.set(
      relation.toTable,
      (referencedBy.get(relation.toTable) ?? 0) + 1,
    );
  });

  const [center, ...rest] = [...tables].sort((a, b) => {
    const scoreA = (degree.get(a.id) ?? 0) + (referencedBy.get(a.id) ?? 0) * 2;
    const scoreB = (degree.get(b.id) ?? 0) + (referencedBy.get(b.id) ?? 0) * 2;
    const scoreDiff = scoreB - scoreA;
    return scoreDiff !== 0 ? scoreDiff : a.name.localeCompare(b.name);
  });
  const orderedRest = rest.sort((a, b) => {
    const relationDiff =
      (degree.get(b.id) ?? 0) -
      (degree.get(a.id) ?? 0) ||
      (referencedBy.get(b.id) ?? 0) - (referencedBy.get(a.id) ?? 0);
    return relationDiff !== 0 ? relationDiff : a.name.localeCompare(b.name);
  });
  const positions: Record<string, DatabaseTablePosition> = {
    [center.id]: {
      x: DB_GRID_OFFSET + DB_TABLE_WIDTH + DB_GRID_GAP_X + 120,
      y: DB_GRID_OFFSET + 220,
    },
  };

  const radiusX = DB_TABLE_WIDTH + DB_GRID_GAP_X + 140;
  const radiusY = 240;
  const preferredAngles =
    orderedRest.length <= 3
      ? [-Math.PI / 2, Math.PI, 0]
      : [
          -Math.PI / 2,
          Math.PI,
          0,
          Math.PI / 2,
          (-Math.PI * 3) / 4,
          -Math.PI / 4,
          (Math.PI * 3) / 4,
          Math.PI / 4,
        ];

  orderedRest.forEach((table, index) => {
    const angle =
      preferredAngles[index] ??
      (Math.PI * 2 * index) / Math.max(1, orderedRest.length) - Math.PI / 2;
    positions[table.id] = {
      x: Math.round(positions[center.id].x + Math.cos(angle) * radiusX),
      y: Math.round(positions[center.id].y + Math.sin(angle) * radiusY),
    };
  });

  const minX = Math.min(
    ...Object.values(positions).map((position) => position.x),
  );
  const minY = Math.min(
    ...Object.values(positions).map((position) => position.y),
  );
  if (minX < DB_GRID_OFFSET || minY < DB_GRID_OFFSET) {
    Object.values(positions).forEach((position) => {
      position.x += Math.max(0, DB_GRID_OFFSET - minX);
      position.y += Math.max(0, DB_GRID_OFFSET - minY);
    });
  }

  return positions;
}

export function computeDatabaseAutoLayoutByAlgorithm(
  tables: DatabaseTable[],
  relations: DatabaseRelation[],
  algorithm: DatabaseAutoLayoutAlgorithm,
): Record<string, DatabaseTablePosition> {
  if (algorithm === 'left-right') {
    return computeLeftRightLayout(tables, relations);
  }
  if (algorithm === 'snowflake') {
    return computeSnowflakeLayout(tables, relations);
  }
  return computeCompactLayout(tables);
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
