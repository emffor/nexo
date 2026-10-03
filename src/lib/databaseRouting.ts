import type { DatabaseRelationPathPoint, DatabaseRelationSide } from '../types/database';

type Point = DatabaseRelationPathPoint;
export type DatabaseRoutingObstacle = Point & { width: number; height: number };
const CLEARANCE = 20;

export function resolveDatabaseTablePosition(
  position: Point,
  width: number,
  height: number,
  obstacles: DatabaseRoutingObstacle[],
): Point {
  const gap = CLEARANCE * 2 + 8;
  const free = (p: Point) => obstacles.every((r) =>
    p.x + width + gap <= r.x || p.x >= r.x + r.width + gap ||
    p.y + height + gap <= r.y || p.y >= r.y + r.height + gap,
  );
  if (free(position)) return position;
  const xs = [position.x, ...obstacles.flatMap((r) => [r.x - width - gap, r.x + r.width + gap])];
  const ys = [position.y, ...obstacles.flatMap((r) => [r.y - height - gap, r.y + r.height + gap])];
  let nearest = position;
  let distance = Infinity;
  for (const x of xs) for (const y of ys) {
    const candidate = { x, y };
    const cost = Math.hypot(x - position.x, y - position.y);
    if (cost < distance && free(candidate)) { nearest = candidate; distance = cost; }
  }
  return nearest;
}

function contains(point: Point, rect: DatabaseRoutingObstacle): boolean {
  return point.x > rect.x && point.x < rect.x + rect.width &&
    point.y > rect.y && point.y < rect.y + rect.height;
}

// Interseção com o interior: tocar o ponto de conexão na borda é permitido.
function intersects(from: Point, to: Point, rect: DatabaseRoutingObstacle): boolean {
  let start = 0;
  let end = 1;
  for (const axis of ['x', 'y'] as const) {
    const delta = to[axis] - from[axis];
    const min = rect[axis];
    const max = min + (axis === 'x' ? rect.width : rect.height);
    if (delta === 0) {
      if (from[axis] <= min || from[axis] >= max) return false;
    } else {
      const first = (min - from[axis]) / delta;
      const last = (max - from[axis]) / delta;
      start = Math.max(start, Math.min(first, last));
      end = Math.min(end, Math.max(first, last));
      if (start >= end) return false;
    }
  }
  return start < end;
}

export function isDatabasePathBlocked(points: Point[], obstacles: DatabaseRoutingObstacle[]): boolean {
  return points.slice(1).some((point, index) =>
    obstacles.some((rect) => intersects(points[index], point, rect)),
  );
}

export function isDatabaseCurveBlocked(points: Point[], obstacles: DatabaseRoutingObstacle[]): boolean {
  if (points.length !== 4) return true;
  const samples: Point[] = [];
  // Subdivisão adaptativa mantém o teste preciso mesmo em curvas muito longas.
  const flatten = (curve: Point[], depth: number) => {
    const [a, b, c, d] = curve;
    const distance = (p: Point) => {
      const length = Math.hypot(d.x - a.x, d.y - a.y);
      return length === 0 ? Math.hypot(p.x - a.x, p.y - a.y)
        : Math.abs((d.y - a.y) * p.x - (d.x - a.x) * p.y + d.x * a.y - d.y * a.x) / length;
    };
    if (depth >= 12 || (distance(b) < 0.25 && distance(c) < 0.25 &&
      Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(c.x - b.x, c.y - b.y) +
      Math.hypot(d.x - c.x, d.y - c.y) <= Math.hypot(d.x - a.x, d.y - a.y) + 0.5)) {
      samples.push(a);
      return;
    }
    const mid = (p: Point, q: Point): Point => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    const ab = mid(a, b), bc = mid(b, c), cd = mid(c, d);
    const abc = mid(ab, bc), bcd = mid(bc, cd), center = mid(abc, bcd);
    flatten([a, ab, abc, center], depth + 1);
    flatten([center, bcd, cd, d], depth + 1);
  };
  flatten(points, 0);
  samples.push(points[3]);
  return isDatabasePathBlocked(samples, obstacles);
}

export function routeDatabaseConnection(
  from: Point,
  fromSide: DatabaseRelationSide,
  to: Point,
  toSide: DatabaseRelationSide,
  obstacles: DatabaseRoutingObstacle[],
): Point[] | null {
  const start = { x: from.x + (fromSide === 'right' ? CLEARANCE : -CLEARANCE), y: from.y };
  const finish = { x: to.x + (toSide === 'right' ? CLEARANCE : -CLEARANCE), y: to.y };
  if (isDatabasePathBlocked([from, start], obstacles) || isDatabasePathBlocked([finish, to], obstacles)) return null;
  const padded = obstacles.map((rect) => ({
    x: rect.x - CLEARANCE, y: rect.y - CLEARANCE,
    width: rect.width + CLEARANCE * 2, height: rect.height + CLEARANCE * 2,
  }));
  if (padded.some((rect) => contains(start, rect) || contains(finish, rect))) return null;
  const sorted = (values: number[]) => [...new Set(values)].sort((a, b) => a - b);
  const xs = sorted([start.x, finish.x, ...padded.flatMap((r) => [r.x, r.x + r.width])]);
  const ys = sorted([start.y, finish.y, ...padded.flatMap((r) => [r.y, r.y + r.height])]);
  const index = (x: number, y: number) => y * xs.length + x;
  const startIndex = index(xs.indexOf(start.x), ys.indexOf(start.y));
  const endIndex = index(xs.indexOf(finish.x), ys.indexOf(finish.y));
  const point = (id: number): Point => ({ x: xs[id % xs.length], y: ys[Math.floor(id / xs.length)] });
  const distances = new Map([[startIndex, 0]]);
  const previous = new Map<number, number>();
  const queue = new Set([startIndex]);
  const heuristic = (id: number) => Math.abs(point(id).x - finish.x) + Math.abs(point(id).y - finish.y);
  while (queue.size) {
    let current = -1;
    let best = Infinity;
    for (const id of queue) {
      const cost = distances.get(id)! + heuristic(id);
      if (cost < best) { best = cost; current = id; }
    }
    if (current === endIndex) {
      const path = [finish];
      while (previous.has(current)) {
        current = previous.get(current)!;
        path.unshift(point(current));
      }
      const result = [from, ...path, to];
      return result.filter((p, i) => {
        const before = result[i - 1], after = result[i + 1];
        return !before || !after || !((before.x === p.x && p.x === after.x) || (before.y === p.y && p.y === after.y));
      });
    }
    queue.delete(current);
    const x = current % xs.length, y = Math.floor(current / xs.length);
    const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length) continue;
      const next = index(nx, ny), candidate = point(next);
      if (padded.some((r) => contains(candidate, r) || intersects(point(current), candidate, r))) continue;
      const distance = distances.get(current)! + Math.abs(point(current).x - candidate.x) + Math.abs(point(current).y - candidate.y);
      if (distance >= (distances.get(next) ?? Infinity)) continue;
      distances.set(next, distance);
      previous.set(next, current);
      queue.add(next);
    }
  }
  return null;
}

export function buildRoutedDatabasePath(points: Point[], curved: boolean): string {
  if (points.length < 2) return '';
  let data = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i], before = points[i - 1], after = points[i + 1];
    if (!curved || !after) { data += ` L ${p.x} ${p.y}`; continue; }
    const incoming = Math.hypot(p.x - before.x, p.y - before.y);
    const outgoing = Math.hypot(after.x - p.x, after.y - p.y);
    const radius = Math.min(8, incoming / 2, outgoing / 2);
    if (!incoming || !outgoing) continue;
    const entry = { x: p.x + (before.x - p.x) * radius / incoming, y: p.y + (before.y - p.y) * radius / incoming };
    const exit = { x: p.x + (after.x - p.x) * radius / outgoing, y: p.y + (after.y - p.y) * radius / outgoing };
    data += ` L ${entry.x} ${entry.y} Q ${p.x} ${p.y} ${exit.x} ${exit.y}`;
  }
  return data;
}
