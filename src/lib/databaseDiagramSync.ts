import {
  DB_HEADER_HEIGHT,
  DB_ROW_HEIGHT,
  DB_TABLE_WIDTH,
  ensureTablePositions,
} from './databaseLayout';
import type {
  DatabaseDiagramVisualState,
  DatabaseRelation,
  DatabaseRelationPathPoint,
  DatabaseRelationPathState,
  DatabaseRelationSide,
  DatabaseTable,
  DatabaseTablePosition,
} from '../types/database';

interface ReconcileDatabaseVisualStateOptions {
  state: DatabaseDiagramVisualState;
  tables: DatabaseTable[];
  relations: DatabaseRelation[];
  isDbmlValid: boolean;
  canPruneOrphans: boolean;
}

interface RemapRelationPathsOptions {
  state: DatabaseDiagramVisualState;
  previousRelations: DatabaseRelation[];
  nextRelations: DatabaseRelation[];
  mapRelation: (relation: DatabaseRelation) => DatabaseRelation;
}

interface RemapTableRenameOptions {
  state: DatabaseDiagramVisualState;
  previousRelations: DatabaseRelation[];
  nextRelations: DatabaseRelation[];
  currentName: string;
  nextName: string;
}

interface RemapColumnRenameOptions {
  state: DatabaseDiagramVisualState;
  previousRelations: DatabaseRelation[];
  nextRelations: DatabaseRelation[];
  tableName: string;
  currentName: string;
  nextName: string;
}

interface ReanchorMovedTableOptions {
  state: DatabaseDiagramVisualState;
  tables: DatabaseTable[];
  relations: DatabaseRelation[];
  tableId: string;
  nextPosition: DatabaseTablePosition;
}

function relationKey(relation: DatabaseRelation): string {
  return [
    relation.name ?? '',
    relation.fromTable,
    relation.fromColumn,
    relation.kind,
    relation.toTable,
    relation.toColumn,
  ].join('|');
}

function buildRelationLookupByKey(
  relations: DatabaseRelation[],
): Map<string, DatabaseRelation> {
  const map = new Map<string, DatabaseRelation>();
  for (const relation of relations) {
    const key = relationKey(relation);
    if (!map.has(key)) {
      map.set(key, relation);
    }
  }
  return map;
}

function remapRelationPaths({
  state,
  previousRelations,
  nextRelations,
  mapRelation,
}: RemapRelationPathsOptions): DatabaseDiagramVisualState['relationPaths'] {
  if (!state.relationPaths) {
    return undefined;
  }

  const previousById = new Map(
    previousRelations.map((relation) => [relation.id, relation]),
  );
  const nextById = new Map(nextRelations.map((relation) => [relation.id, relation]));
  const nextByKey = buildRelationLookupByKey(nextRelations);
  const nextRelationPaths: NonNullable<DatabaseDiagramVisualState['relationPaths']> =
    {};

  for (const [relationId, path] of Object.entries(state.relationPaths)) {
    const previousRelation = previousById.get(relationId);

    if (!previousRelation) {
      if (nextById.has(relationId)) {
        nextRelationPaths[relationId] = path;
      }
      continue;
    }

    const expectedRelation = mapRelation(previousRelation);
    const nextRelation =
      nextByKey.get(relationKey(expectedRelation)) ?? nextById.get(relationId);

    if (nextRelation) {
      nextRelationPaths[nextRelation.id] = path;
    }
  }

  return Object.keys(nextRelationPaths).length > 0
    ? nextRelationPaths
    : undefined;
}

function sameRelationPaths(
  current: DatabaseDiagramVisualState['relationPaths'],
  next: DatabaseDiagramVisualState['relationPaths'],
): boolean {
  if (current === next) {
    return true;
  }

  const currentKeys = Object.keys(current ?? {});
  const nextKeys = Object.keys(next ?? {});
  if (currentKeys.length !== nextKeys.length) {
    return false;
  }

  return currentKeys.every((key) => current?.[key] === next?.[key]);
}

function isOrthogonalPath(points: DatabaseRelationPathPoint[]): boolean {
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (from.x !== to.x && from.y !== to.y) {
      return false;
    }
  }

  return true;
}

function columnYCenter(columnIndex: number): number {
  return DB_HEADER_HEIGHT + columnIndex * DB_ROW_HEIGHT + DB_ROW_HEIGHT / 2;
}

function getColumnAnchor(
  position: DatabaseTablePosition,
  columnIndex: number,
  side: DatabaseRelationSide,
): DatabaseRelationPathPoint {
  return {
    x: side === 'left' ? position.x : position.x + DB_TABLE_WIDTH,
    y: position.y + columnYCenter(columnIndex),
  };
}

function getRelationColumnIndex(
  table: DatabaseTable | undefined,
  columnName: string,
): number {
  return table?.columns.findIndex((column) => column.name === columnName) ?? -1;
}

function reanchorEndpoint(
  points: DatabaseRelationPathPoint[],
  endpointIndex: number,
  oldAnchor: DatabaseRelationPathPoint,
  nextAnchor: DatabaseRelationPathPoint,
): DatabaseRelationPathPoint[] {
  const nextPoints = points.map((point) => ({ ...point }));
  const neighborIndex = endpointIndex === 0 ? 1 : nextPoints.length - 2;
  const neighbor = nextPoints[neighborIndex];
  const oldEndpoint = points[endpointIndex];
  const isCurvePath = !isOrthogonalPath(points);
  const deltaX = nextAnchor.x - oldAnchor.x;
  const deltaY = nextAnchor.y - oldAnchor.y;

  nextPoints[endpointIndex] = nextAnchor;

  if (!neighbor || !oldEndpoint) {
    return nextPoints;
  }

  if (isCurvePath) {
    nextPoints[neighborIndex] = {
      x: neighbor.x + deltaX,
      y: neighbor.y + deltaY,
    };
    return nextPoints;
  }

  if (oldEndpoint.y === neighbor.y) {
    nextPoints[neighborIndex] = { ...neighbor, y: nextAnchor.y };
  } else if (oldEndpoint.x === neighbor.x) {
    nextPoints[neighborIndex] = { ...neighbor, x: nextAnchor.x };
  } else {
    nextPoints[neighborIndex] = {
      x: neighbor.x + deltaX,
      y: neighbor.y + deltaY,
    };
  }

  return nextPoints;
}

export function reconcileDatabaseVisualState({
  state,
  tables,
  relations,
  isDbmlValid,
  canPruneOrphans,
}: ReconcileDatabaseVisualStateOptions): DatabaseDiagramVisualState {
  let positions = state.positions;
  let relationPaths = state.relationPaths;
  let changed = false;

  if (isDbmlValid) {
    const nextPositions = ensureTablePositions(tables, positions);
    if (nextPositions !== positions) {
      positions = nextPositions;
      changed = true;
    }
  }

  if (isDbmlValid && canPruneOrphans) {
    const validTableIds = new Set(tables.map((table) => table.id));
    const filteredPositions: DatabaseDiagramVisualState['positions'] = {};
    let removedPosition = false;

    for (const [tableId, position] of Object.entries(positions)) {
      if (validTableIds.has(tableId)) {
        filteredPositions[tableId] = position;
      } else {
        removedPosition = true;
      }
    }

    if (removedPosition) {
      positions = filteredPositions;
      changed = true;
    }

    if (relationPaths) {
      const validRelationIds = new Set(
        relations.map((relation) => relation.id),
      );
      const filteredPaths: NonNullable<DatabaseDiagramVisualState['relationPaths']> =
        {};
      let removedPath = false;

      for (const [relationId, path] of Object.entries(relationPaths)) {
        if (validRelationIds.has(relationId)) {
          filteredPaths[relationId] = path;
        } else {
          removedPath = true;
        }
      }

      if (removedPath) {
        relationPaths =
          Object.keys(filteredPaths).length > 0 ? filteredPaths : undefined;
        changed = true;
      }
    }
  }

  return changed ? { ...state, positions, relationPaths } : state;
}

export function remapDatabaseVisualStateForTableRename({
  state,
  previousRelations,
  nextRelations,
  currentName,
  nextName,
}: RemapTableRenameOptions): DatabaseDiagramVisualState {
  if (currentName === nextName) {
    return state;
  }

  let positions = state.positions;
  let changed = false;

  if (state.positions[currentName]) {
    const nextPositions = { ...state.positions };
    nextPositions[nextName] = state.positions[currentName];
    delete nextPositions[currentName];
    positions = nextPositions;
    changed = true;
  }

  const relationPaths = remapRelationPaths({
    state,
    previousRelations,
    nextRelations,
    mapRelation: (relation) => ({
      ...relation,
      fromTable:
        relation.fromTable === currentName ? nextName : relation.fromTable,
      toTable: relation.toTable === currentName ? nextName : relation.toTable,
    }),
  });

  if (!sameRelationPaths(state.relationPaths, relationPaths)) {
    changed = true;
  }

  return changed ? { ...state, positions, relationPaths } : state;
}

export function remapDatabaseVisualStateForColumnRename({
  state,
  previousRelations,
  nextRelations,
  tableName,
  currentName,
  nextName,
}: RemapColumnRenameOptions): DatabaseDiagramVisualState {
  if (currentName === nextName) {
    return state;
  }

  const relationPaths = remapRelationPaths({
    state,
    previousRelations,
    nextRelations,
    mapRelation: (relation) => ({
      ...relation,
      fromColumn:
        relation.fromTable === tableName && relation.fromColumn === currentName
          ? nextName
          : relation.fromColumn,
      toColumn:
        relation.toTable === tableName && relation.toColumn === currentName
          ? nextName
          : relation.toColumn,
    }),
  });

  return sameRelationPaths(state.relationPaths, relationPaths)
    ? state
    : { ...state, relationPaths };
}

export function reanchorRelationPathsForMovedTable({
  state,
  tables,
  relations,
  tableId,
  nextPosition,
}: ReanchorMovedTableOptions): DatabaseDiagramVisualState {
  if (!state.relationPaths) {
    return state;
  }

  const previousPosition = state.positions[tableId];
  if (
    !previousPosition ||
    (previousPosition.x === nextPosition.x && previousPosition.y === nextPosition.y)
  ) {
    return state;
  }

  const tableById = new Map(tables.map((table) => [table.id, table]));
  const relationById = new Map(
    relations.map((relation) => [relation.id, relation]),
  );
  const nextRelationPaths: NonNullable<DatabaseDiagramVisualState['relationPaths']> =
    {};
  let changed = false;

  for (const [relationId, path] of Object.entries(state.relationPaths)) {
    const relation = relationById.get(relationId);
    if (
      !relation ||
      (relation.fromTable !== tableId && relation.toTable !== tableId)
    ) {
      nextRelationPaths[relationId] = path;
      continue;
    }

    const fromTable = tableById.get(relation.fromTable);
    const toTable = tableById.get(relation.toTable);
    const fromColumnIndex = getRelationColumnIndex(
      fromTable,
      relation.fromColumn,
    );
    const toColumnIndex = getRelationColumnIndex(toTable, relation.toColumn);
    const fromPosition = state.positions[relation.fromTable];
    const toPosition = state.positions[relation.toTable];

    if (
      !fromTable ||
      !toTable ||
      fromColumnIndex < 0 ||
      toColumnIndex < 0 ||
      !fromPosition ||
      !toPosition ||
      path.points.length < 2
    ) {
      nextRelationPaths[relationId] = path;
      continue;
    }

    let points = path.points.map((point) => ({ ...point }));

    if (relation.fromTable === tableId) {
      const oldAnchor = getColumnAnchor(
        previousPosition,
        fromColumnIndex,
        path.fromSide,
      );
      const nextAnchor = getColumnAnchor(
        nextPosition,
        fromColumnIndex,
        path.fromSide,
      );
      points = reanchorEndpoint(points, 0, oldAnchor, nextAnchor);
    }

    if (relation.toTable === tableId) {
      const oldAnchor = getColumnAnchor(
        previousPosition,
        toColumnIndex,
        path.toSide,
      );
      const nextAnchor = getColumnAnchor(
        nextPosition,
        toColumnIndex,
        path.toSide,
      );
      points = reanchorEndpoint(points, points.length - 1, oldAnchor, nextAnchor);
    }

    nextRelationPaths[relationId] = {
      ...path,
      points,
    } satisfies DatabaseRelationPathState;
    changed = true;
  }

  return changed
    ? { ...state, relationPaths: nextRelationPaths }
    : state;
}
