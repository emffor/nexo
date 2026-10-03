import {
  DB_HEADER_HEIGHT,
  DB_ROW_HEIGHT,
  DB_TABLE_WIDTH
} from "../lib/databaseLayout";
import type {
  DatabaseRelation,
  DatabaseRelationPathState,
  DatabaseRelationSide,
  DatabaseTablePosition
} from "../types/database";
const RELATION_GUIDE_POINT_SPACING = 26;
export function columnYCenter(columnIndex: number): number {
  return DB_HEADER_HEIGHT + columnIndex * DB_ROW_HEIGHT + DB_ROW_HEIGHT / 2;
}

export function getColumnAnchor(
  position: DatabaseTablePosition,
  columnIndex: number,
  side: DatabaseRelationSide,
): { x: number; y: number } {
  return {
    x: side === "left" ? position.x : position.x + DB_TABLE_WIDTH,
    y: position.y + columnYCenter(columnIndex),
  };
}

export function buildOrthogonalPath(
  from: { x: number; y: number },
  fromSide: DatabaseRelationSide,
  to: { x: number; y: number },
  toSide: DatabaseRelationSide,
): number[] {
  const handle = 44;

  if (fromSide === toSide) {
    const direction = fromSide === "right" ? 1 : -1;
    const routeX =
      direction > 0
        ? Math.max(from.x, to.x) + handle * 1.55
        : Math.min(from.x, to.x) - handle * 1.55;

    return [from.x, from.y, routeX, from.y, routeX, to.y, to.x, to.y];
  }

  const fromHandle = {
    x: from.x + (fromSide === "right" ? handle : -handle),
    y: from.y,
  };
  const toHandle = {
    x: to.x + (toSide === "right" ? handle : -handle),
    y: to.y,
  };
  const hasSpaceBetweenAnchors =
    (fromSide === "right" && toSide === "left" && from.x <= to.x) ||
    (fromSide === "left" && toSide === "right" && from.x >= to.x);
  const midX =
    (hasSpaceBetweenAnchors ? from.x + to.x : fromHandle.x + toHandle.x) / 2;

  if (hasSpaceBetweenAnchors) {
    return [from.x, from.y, midX, from.y, midX, to.y, to.x, to.y];
  }

  return [
    from.x,
    from.y,
    fromHandle.x,
    fromHandle.y,
    midX,
    fromHandle.y,
    midX,
    toHandle.y,
    toHandle.x,
    toHandle.y,
    to.x,
    to.y,
  ];
}

export function pointArrayToPairs(points: number[]): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];
  for (let index = 0; index < points.length - 1; index += 2) {
    result.push({ x: points[index], y: points[index + 1] });
  }
  return result;
}

export function pointPairsToArray(points: { x: number; y: number }[]): number[] {
  return points.flatMap((point) => [point.x, point.y]);
}

export function normalizeRelationPath(
  path: DatabaseRelationPathState | undefined,
  fallbackPoints: number[],
  fromAnchor: { x: number; y: number },
  toAnchor: { x: number; y: number },
): number[] {
  if (!path || path.points.length < 2) {
    return fallbackPoints;
  }

  const points = path.points.map((point) => ({ ...point }));
  points[0] = fromAnchor;
  points[points.length - 1] = toAnchor;

  return pointPairsToArray(points);
}

export function moveRelationSegment(
  points: { x: number; y: number }[],
  segmentIndex: number,
  nextPosition: { x: number; y: number },
): { x: number; y: number }[] {
  const result = points.map((point) => ({ ...point }));
  const from = result[segmentIndex];
  const to = result[segmentIndex + 1];

  if (!from || !to) {
    return result;
  }

  if (from.x === to.x) {
    const x = Math.round(nextPosition.x);
    result[segmentIndex] = { ...from, x };
    result[segmentIndex + 1] = { ...to, x };
    return result;
  }

  if (from.y === to.y) {
    const y = Math.round(nextPosition.y);
    result[segmentIndex] = { ...from, y };
    result[segmentIndex + 1] = { ...to, y };
  }

  return result;
}

export function moveLinkedCurveControlPoints(
  points: { x: number; y: number }[],
  controlIndex: number,
  nextPosition: { x: number; y: number },
): { x: number; y: number }[] {
  const result = points.map((point) => ({ ...point }));
  const current = result[controlIndex];
  const pairedIndex = controlIndex === 1 ? 2 : 1;
  const paired = result[pairedIndex];

  if (!current || !paired || controlIndex < 1 || controlIndex > 2) {
    return result;
  }

  const nextX = Math.round(nextPosition.x);
  const nextY = Math.round(nextPosition.y);
  const deltaX = nextX - current.x;
  const deltaY = nextY - current.y;

  result[controlIndex] = { ...current, x: nextX, y: nextY };
  result[pairedIndex] = {
    ...paired,
    x: paired.x + deltaX,
    y: paired.y + deltaY,
  };

  return result;
}

export function buildSegmentHandles(points: { x: number; y: number }[]): {
  index: number;
  x: number;
  y: number;
  orientation: "horizontal" | "vertical";
}[] {
  const handles: {
    index: number;
    x: number;
    y: number;
    orientation: "horizontal" | "vertical";
  }[] = [];

  for (let index = 1; index < points.length - 2; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) {
      continue;
    }
    if (from.x === to.x) {
      handles.push({
        index,
        x: from.x,
        y: (from.y + to.y) / 2,
        orientation: "vertical",
      });
    } else if (from.y === to.y) {
      handles.push({
        index,
        x: (from.x + to.x) / 2,
        y: from.y,
        orientation: "horizontal",
      });
    }
  }

  return handles;
}

export function buildRelationGuidePoints(
  points: { x: number; y: number }[],
): { x: number; y: number }[] {
  const guidePoints: { x: number; y: number }[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!from || !to) {
      continue;
    }

    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const length = Math.hypot(deltaX, deltaY);
    if (length < RELATION_GUIDE_POINT_SPACING * 1.35) {
      continue;
    }

    const steps = Math.max(
      1,
      Math.floor(length / RELATION_GUIDE_POINT_SPACING),
    );
    for (let step = 1; step < steps; step += 1) {
      const ratio = step / steps;
      guidePoints.push({
        x: from.x + deltaX * ratio,
        y: from.y + deltaY * ratio,
      });
    }
  }

  return guidePoints;
}

export function chooseRelationSides(
  fromPosition: DatabaseTablePosition,
  fromHeight: number,
  toPosition: DatabaseTablePosition,
  toHeight: number,
): { fromSide: DatabaseRelationSide; toSide: DatabaseRelationSide } {
  const fromCenterX = fromPosition.x + DB_TABLE_WIDTH / 2;
  const toCenterX = toPosition.x + DB_TABLE_WIDTH / 2;
  const horizontalOverlap =
    fromPosition.x < toPosition.x + DB_TABLE_WIDTH &&
    toPosition.x < fromPosition.x + DB_TABLE_WIDTH;
  const verticalOverlap =
    fromPosition.y < toPosition.y + toHeight &&
    toPosition.y < fromPosition.y + fromHeight;

  if (horizontalOverlap && !verticalOverlap) {
    return { fromSide: "right", toSide: "right" };
  }

  return toCenterX >= fromCenterX
    ? { fromSide: "right", toSide: "left" }
    : { fromSide: "left", toSide: "right" };
}

export function buildPathControlPoints(points: number[]): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];

  for (let index = 2; index < points.length - 2; index += 2) {
    const current = { x: points[index], y: points[index + 1] };
    const previous = result[result.length - 1];
    if (!previous || previous.x !== current.x || previous.y !== current.y) {
      result.push(current);
    }
  }

  return result;
}

export function buildOrthogonalPathData(points: number[]): string {
  if (points.length < 4) {
    return "";
  }
  let data = `M ${points[0]} ${points[1]}`;
  for (let index = 2; index < points.length; index += 2) {
    data += ` L ${points[index]} ${points[index + 1]}`;
  }
  return data;
}

export function buildCurvePathData(
  from: { x: number; y: number },
  fromSide: DatabaseRelationSide,
  to: { x: number; y: number },
  toSide: DatabaseRelationSide,
): string {
  const fromDirection = fromSide === "right" ? 1 : -1;
  const toDirection = toSide === "right" ? 1 : -1;
  const distance = Math.max(80, Math.abs(to.x - from.x) * 0.45);
  const controlFromX = from.x + fromDirection * distance;
  const controlToX = to.x + toDirection * distance;

  return `M ${from.x} ${from.y} C ${controlFromX} ${from.y}, ${controlToX} ${to.y}, ${to.x} ${to.y}`;
}

export function buildCurvePoints(
  from: { x: number; y: number },
  fromSide: DatabaseRelationSide,
  to: { x: number; y: number },
  toSide: DatabaseRelationSide,
): { x: number; y: number }[] {
  const fromDirection = fromSide === "right" ? 1 : -1;
  const toDirection = toSide === "right" ? 1 : -1;
  const distance = Math.max(80, Math.abs(to.x - from.x) * 0.45);

  return [
    from,
    { x: from.x + fromDirection * distance, y: from.y },
    { x: to.x + toDirection * distance, y: to.y },
    to,
  ];
}

export function buildCurvePathDataFromPoints(
  points: { x: number; y: number }[],
): string {
  if (points.length < 4) {
    return "";
  }

  const [from, controlFrom, controlTo, to] = points;
  return `M ${from.x} ${from.y} C ${controlFrom.x} ${controlFrom.y}, ${controlTo.x} ${controlTo.y}, ${to.x} ${to.y}`;
}

export function buildCurveMidpoint(points: { x: number; y: number }[]): {
  x: number;
  y: number;
} {
  if (points.length < 4) {
    return points[0] ?? { x: 0, y: 0 };
  }

  const [from, controlFrom, controlTo, to] = points;
  return {
    x:
      (from.x + 3 * controlFrom.x + 3 * controlTo.x + to.x) /
      8,
    y:
      (from.y + 3 * controlFrom.y + 3 * controlTo.y + to.y) /
      8,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function isRelationEndpoint(
  relation: DatabaseRelation | undefined,
  tableId: string,
  columnName: string,
): boolean {
  if (!relation) {
    return false;
  }
  return (
    (relation.fromTable === tableId && relation.fromColumn === columnName) ||
    (relation.toTable === tableId && relation.toColumn === columnName)
  );
}

export function relationTouchesTable(
  relation: DatabaseRelation,
  tableId: string,
): boolean {
  return relation.fromTable === tableId || relation.toTable === tableId;
}

export function buildRelationMidpoint(points: number[]): { x: number; y: number } {
  const middleIndex = Math.max(2, Math.floor((points.length - 2) / 4) * 2);
  return {
    x: points[middleIndex],
    y: points[middleIndex + 1],
  };
}
