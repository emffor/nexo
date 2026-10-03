"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Circle,
  Group,
  Layer,
  Line,
  Path,
  Rect,
  Stage,
  Text,
} from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import Konva from "konva";

import { UI_CODE_FONT_FAMILY, UI_FONT_FAMILY, UI_RADIUS, UI_THEME } from "../../lib/uiTheme";
import { buildRoutedDatabasePath, isDatabaseCurveBlocked, isDatabasePathBlocked, resolveDatabaseTablePosition, routeDatabaseConnection, type DatabaseRoutingObstacle } from "../../lib/databaseRouting";
import type { AppTheme, DiagramEdgeStyle } from "../../lib/preferences";
import {
  isValidDbmlColumnIdentifier,
  isValidDbmlIdentifier,
} from "../../lib/dbml";
import {
  DB_HEADER_HEIGHT,
  DB_ROW_HEIGHT,
  DB_TABLE_PADDING_BOTTOM,
  DB_TABLE_WIDTH,
  computeDatabaseAutoLayoutByAlgorithm,
  computeDatabaseAutoLayout,
  computeDatabaseTableHeight,
  type DatabaseAutoLayoutAlgorithm,
} from "../../lib/databaseLayout";
import { reanchorRelationPathsForMovedTable } from "../../lib/databaseDiagramSync";
import type {
  DatabaseDiagramViewport,
  DatabaseDiagramVisualState,
  DatabaseRelation,
  DatabaseRelationPathState,
  DatabaseRelationSide,
  DatabaseTable,
  DatabaseTablePosition,
} from "../../types/database";

interface DatabaseDiagramPanelProps {
  tables: DatabaseTable[];
  relations: DatabaseRelation[];
  theme: AppTheme;
  state: DatabaseDiagramVisualState;
  onStateChange: (state: DatabaseDiagramVisualState) => void;
  onRenameTable?: (tableName: string, nextName: string) => boolean;
  onRenameColumn?: (
    tableName: string,
    columnName: string,
    nextName: string,
  ) => boolean;
  edgeStyle?: DiagramEdgeStyle;
  resetSignal?: number;
}

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.8;
const SCALE_STEP = 1.05;
const INITIAL_VIEWPORT: DatabaseDiagramViewport = { x: 0, y: 0, scale: 1 };
const EDITOR_WIDTH = 280;
const RELATION_GUIDE_POINT_SPACING = 26;

Konva.pixelRatio = 1;

type InteractionMode = "select" | "pan";

const AUTO_LAYOUT_OPTIONS: {
  id: DatabaseAutoLayoutAlgorithm;
  label: string;
  description: string;
  shortcut: string;
  icon: "flow" | "snowflake" | "grid";
}[] = [
  {
    id: "left-right",
    label: "Esquerda-direita",
    description:
      "Organiza tabelas da esquerda para a direita com base na direção dos relacionamentos.",
    shortcut: "1",
    icon: "flow",
  },
  {
    id: "snowflake",
    label: "Floco de neve",
    description:
      "Mantém as tabelas mais conectadas no centro e distribui as demais ao redor.",
    shortcut: "2",
    icon: "snowflake",
  },
  {
    id: "compact",
    label: "Compacto",
    description:
      "Organiza tabelas em uma grade retangular curta para diagramas menores.",
    shortcut: "3",
    icon: "grid",
  },
];

type ActiveEditor =
  | { type: "table"; tableId: string; draft: string; error: string | null }
  | {
      type: "column";
      tableId: string;
      columnName: string;
      draft: string;
      error: string | null;
    };

type LiveTablePosition = {
  id: string;
  x: number;
  y: number;
};

type LiveRelationPath = {
  relationId: string;
  path: DatabaseRelationPathState;
};

type CurveDragSnapshot = {
  relationId: string;
  controlIndex: number;
  points: { x: number; y: number }[];
};

function AutoLayoutIcon({ icon }: { icon: "flow" | "snowflake" | "grid" }) {
  if (icon === "grid") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-6 w-6"
        fill="none"
        stroke="currentColor"
      >
        {[4, 10, 16].flatMap((y) =>
          [4, 10, 16].map((x) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="4"
              height="4"
              rx="0.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            />
          )),
        )}
      </svg>
    );
  }

  const nodes =
    icon === "snowflake"
      ? [
          [10, 10],
          [4, 4],
          [16, 4],
          [4, 16],
          [16, 16],
        ]
      : [
          [4, 5],
          [4, 17],
          [17, 11],
        ];

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon === "snowflake" ? (
        <>
          <path d="M10 10 6 6M14 10l4-4M10 14l-4 4M14 14l4 4" />
          <path d="M12 10v4M10 12h4" />
        </>
      ) : (
        <>
          <path d="M8 5h5a4 4 0 0 1 4 4v2" />
          <path d="M8 17h5a4 4 0 0 0 4-4v-2" />
        </>
      )}
      {nodes.map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width="4"
          height="4"
          rx="0.8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        />
      ))}
    </svg>
  );
}

function HandIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 shrink-0"
    >
      <path
        d="M7.5 12.5V7.8a1.3 1.3 0 0 1 2.6 0V12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.1 12V6.8a1.3 1.3 0 0 1 2.6 0V12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.7 12V7.6a1.3 1.3 0 0 1 2.6 0V13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.3 13V8.9a1.3 1.3 0 0 1 2.6 0v6.2c0 2.9-1.8 4.9-4.4 4.9h-2.2c-1.9 0-3.2-.8-4.4-2.2l-1.7-2a1.4 1.4 0 0 1 2-2l.9.9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function columnYCenter(columnIndex: number): number {
  return DB_HEADER_HEIGHT + columnIndex * DB_ROW_HEIGHT + DB_ROW_HEIGHT / 2;
}

function getColumnAnchor(
  position: DatabaseTablePosition,
  columnIndex: number,
  side: DatabaseRelationSide,
): { x: number; y: number } {
  return {
    x: side === "left" ? position.x : position.x + DB_TABLE_WIDTH,
    y: position.y + columnYCenter(columnIndex),
  };
}

function buildOrthogonalPath(
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

function pointArrayToPairs(points: number[]): { x: number; y: number }[] {
  const result: { x: number; y: number }[] = [];
  for (let index = 0; index < points.length - 1; index += 2) {
    result.push({ x: points[index], y: points[index + 1] });
  }
  return result;
}

function pointPairsToArray(points: { x: number; y: number }[]): number[] {
  return points.flatMap((point) => [point.x, point.y]);
}

function normalizeRelationPath(
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

function moveRelationSegment(
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

function moveLinkedCurveControlPoints(
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

function buildSegmentHandles(points: { x: number; y: number }[]): {
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

function buildRelationGuidePoints(
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

function chooseRelationSides(
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

function buildPathControlPoints(points: number[]): { x: number; y: number }[] {
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

function buildOrthogonalPathData(points: number[]): string {
  if (points.length < 4) {
    return "";
  }
  let data = `M ${points[0]} ${points[1]}`;
  for (let index = 2; index < points.length; index += 2) {
    data += ` L ${points[index]} ${points[index + 1]}`;
  }
  return data;
}

function buildCurvePathData(
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

function buildCurvePoints(
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

function buildCurvePathDataFromPoints(
  points: { x: number; y: number }[],
): string {
  if (points.length < 4) {
    return "";
  }

  const [from, controlFrom, controlTo, to] = points;
  return `M ${from.x} ${from.y} C ${controlFrom.x} ${controlFrom.y}, ${controlTo.x} ${controlTo.y}, ${to.x} ${to.y}`;
}

function buildCurveMidpoint(points: { x: number; y: number }[]): {
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isRelationEndpoint(
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

function relationTouchesTable(
  relation: DatabaseRelation,
  tableId: string,
): boolean {
  return relation.fromTable === tableId || relation.toTable === tableId;
}

function CardinalityMarker({
  anchor,
  side,
  label,
  color,
  strokeWidth,
  opacity,
}: {
  anchor: { x: number; y: number };
  side: DatabaseRelationSide;
  label: string | undefined;
  color: string;
  strokeWidth: number;
  opacity: number;
}) {
  if (!label) {
    return null;
  }
  const dir = side === "right" ? 1 : -1;
  const isMany = label === "*" || /n/i.test(label);
  const isOptional = /0/.test(label);

  if (isMany) {
    const tip = { x: anchor.x + dir * 14, y: anchor.y };
    const baseX = anchor.x;
    return (
      <Group listening={false}>
        <Line
          points={[tip.x, tip.y, baseX, anchor.y - 6]}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={opacity}
          lineCap="round"
          perfectDrawEnabled={false}
        />
        <Line
          points={[tip.x, tip.y, baseX, anchor.y]}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={opacity}
          lineCap="round"
          perfectDrawEnabled={false}
        />
        <Line
          points={[tip.x, tip.y, baseX, anchor.y + 6]}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={opacity}
          lineCap="round"
          perfectDrawEnabled={false}
        />
      </Group>
    );
  }

  const tickX = anchor.x + dir * (isOptional ? 14 : 10);
  return (
    <Group listening={false}>
      <Line
        points={[tickX, anchor.y - 5, tickX, anchor.y + 5]}
        stroke={color}
        strokeWidth={strokeWidth}
        opacity={opacity}
        lineCap="round"
        perfectDrawEnabled={false}
      />
      {isOptional ? (
        <Circle
          x={anchor.x + dir * 6}
          y={anchor.y}
          radius={3}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={opacity}
          perfectDrawEnabled={false}
        />
      ) : null}
    </Group>
  );
}

function buildRelationMidpoint(points: number[]): { x: number; y: number } {
  const middleIndex = Math.max(2, Math.floor((points.length - 2) / 4) * 2);
  return {
    x: points[middleIndex],
    y: points[middleIndex + 1],
  };
}

export default function DatabaseDiagramPanel({
  tables,
  relations,
  theme,
  state,
  onStateChange,
  onRenameTable,
  onRenameColumn,
  edgeStyle = "square",
  resetSignal = 0,
}: DatabaseDiagramPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);

  useEffect(() => {
    if (document.fonts) {
      void document.fonts.ready.then(() => stageRef.current?.batchDraw());
    }
  }, []);

  const lastResetRef = useRef(resetSignal);
  const stateRef = useRef(state);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [viewportScale, setViewportScale] = useState(
    state.viewport?.scale ?? INITIAL_VIEWPORT.scale,
  );
  const [interactionMode, setInteractionMode] =
    useState<InteractionMode>("select");
  const [isAutoLayoutOpen, setIsAutoLayoutOpen] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedRelationId, setSelectedRelationId] = useState<string | null>(
    null,
  );
  const [editingRelationId, setEditingRelationId] = useState<string | null>(
    null,
  );
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [hoveredRelationId, setHoveredRelationId] = useState<string | null>(
    null,
  );
  const [activeEditor, setActiveEditor] = useState<ActiveEditor | null>(null);
  const [recordsTableId, setRecordsTableId] = useState<string | null>(null);
  const [liveTablePosition, setLiveTablePosition] =
    useState<LiveTablePosition | null>(null);
  const [liveRelationPath, setLiveRelationPath] =
    useState<LiveRelationPath | null>(null);
  const curveDragSnapshotRef = useRef<CurveDragSnapshot | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const visualPositions = useMemo(() => {
    const result: Record<string, DatabaseTablePosition> = {};
    const obstacles: DatabaseRoutingObstacle[] = [];
    for (const table of tables) {
      const position = liveTablePosition?.id === table.id ? liveTablePosition : state.positions[table.id];
      if (!position) continue;
      const height = computeDatabaseTableHeight(table.columns.length);
      const resolved = resolveDatabaseTablePosition(position, DB_TABLE_WIDTH, height, obstacles);
      result[table.id] = resolved;
      obstacles.push({ ...resolved, width: DB_TABLE_WIDTH, height });
    }
    return result;
  }, [liveTablePosition, state.positions, tables]);

  const routingObstacles = useMemo(() => tables.flatMap((table) => {
    const position = visualPositions[table.id];
    return position ? [{
      id: table.id,
      ...position,
      width: DB_TABLE_WIDTH,
      height: computeDatabaseTableHeight(table.columns.length),
    }] : [];
  }), [tables, visualPositions]);

  const constrainTablePosition = useCallback((id: string, position: DatabaseTablePosition) => {
    const table = tables.find((entry) => entry.id === id);
    if (!table) return position;
    return resolveDatabaseTablePosition(position, DB_TABLE_WIDTH,
      computeDatabaseTableHeight(table.columns.length),
      routingObstacles.filter((entry) => entry.id !== id));
  }, [tables, routingObstacles]);

  // medir container
  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const width = element.clientWidth;
      const height = element.clientHeight;
      setSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const validIds = new Set(tables.map((table) => table.id));
    const validRelationIds = new Set(relations.map((relation) => relation.id));
    if (selectedTableId && !validIds.has(selectedTableId)) {
      setSelectedTableId(null);
    }
    if (hoveredTableId && !validIds.has(hoveredTableId)) {
      setHoveredTableId(null);
    }
    if (recordsTableId && !validIds.has(recordsTableId)) {
      setRecordsTableId(null);
    }
    if (activeEditor && !validIds.has(activeEditor.tableId)) {
      setActiveEditor(null);
    }
    if (
      editingRelationId &&
      !relations.some((relation) => relation.id === editingRelationId)
    ) {
      setEditingRelationId(null);
    }
    if (liveTablePosition && !validIds.has(liveTablePosition.id)) {
      setLiveTablePosition(null);
    }
    if (
      liveRelationPath &&
      !validRelationIds.has(liveRelationPath.relationId)
    ) {
      setLiveRelationPath(null);
    }
  }, [
    activeEditor,
    editingRelationId,
    hoveredTableId,
    liveTablePosition,
    liveRelationPath,
    recordsTableId,
    relations,
    selectedTableId,
    tables,
  ]);

  useEffect(() => {
    if (!liveTablePosition) {
      return;
    }

    const persisted = state.positions[liveTablePosition.id];
    if (
      persisted &&
      persisted.x === liveTablePosition.x &&
      persisted.y === liveTablePosition.y
    ) {
      setLiveTablePosition(null);
    }
  }, [liveTablePosition, state.positions]);

  // aplicar viewport
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const v = state.viewport ?? INITIAL_VIEWPORT;
    stage.position({ x: v.x, y: v.y });
    stage.scale({ x: v.scale, y: v.scale });
    setViewportScale(v.scale);
    stage.batchDraw();
    // só rodamos quando o viewport realmente muda
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.viewport?.x, state.viewport?.y, state.viewport?.scale]);

  // reset signal
  useEffect(() => {
    if (resetSignal === 0 || resetSignal === lastResetRef.current) {
      return;
    }
    lastResetRef.current = resetSignal;
    const positions = computeDatabaseAutoLayout(tables);
    onStateChange({ positions, viewport: INITIAL_VIEWPORT });
  }, [resetSignal, tables, onStateChange]);

  const handleTableDragEnd = useCallback(
    (id: string, event: KonvaEventObject<DragEvent>) => {
      const node = event.target;
      const { x, y } = constrainTablePosition(id, {
        x: Math.round(node.x()), y: Math.round(node.y()),
      });
      node.position({ x, y });
      setLiveTablePosition({ id, x, y });
      const current = stateRef.current;
      const reanchoredState = reanchorRelationPathsForMovedTable({
        state: current,
        tables,
        relations,
        tableId: id,
        nextPosition: { x, y },
      });
      onStateChange({
        ...reanchoredState,
        positions: { ...reanchoredState.positions, [id]: { x, y } },
      });
    },
    [onStateChange, relations, tables, constrainTablePosition],
  );

  const handleTableDragMove = useCallback(
    (id: string, event: KonvaEventObject<DragEvent>) => {
      const node = event.target;
      const position = constrainTablePosition(id, {
        x: Math.round(node.x()), y: Math.round(node.y()),
      });
      node.position(position);
      setLiveTablePosition({ id, ...position });
    },
    [constrainTablePosition],
  );

  const saveRelationPath = useCallback(
    (relationId: string, path: DatabaseRelationPathState) => {
      const current = stateRef.current;
      onStateChange({
        ...current,
        relationPaths: {
          ...current.relationPaths,
          [relationId]: path,
        },
      });
    },
    [onStateChange],
  );

  const previewRelationPath = useCallback(
    (relationId: string, path: DatabaseRelationPathState) => {
      setLiveRelationPath({ relationId, path });
    },
    [],
  );

  const commitRelationPath = useCallback(
    (relationId: string, path: DatabaseRelationPathState) => {
      setLiveRelationPath(null);
      curveDragSnapshotRef.current = null;
      saveRelationPath(relationId, path);
    },
    [saveRelationPath],
  );

  const resetRelationPath = useCallback(
    (relationId: string) => {
      const current = stateRef.current;
      if (!current.relationPaths?.[relationId]) {
        setLiveRelationPath(null);
        curveDragSnapshotRef.current = null;
        setEditingRelationId(null);
        return;
      }

      const nextRelationPaths = { ...current.relationPaths };
      delete nextRelationPaths[relationId];
      onStateChange({
        ...current,
        relationPaths:
          Object.keys(nextRelationPaths).length > 0
            ? nextRelationPaths
            : undefined,
      });
      setLiveRelationPath(null);
      curveDragSnapshotRef.current = null;
      setEditingRelationId(null);
    },
    [onStateChange],
  );

  const handleStageDragEnd = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      const target = event.target;
      if (target !== target.getStage()) {
        return;
      }
      const current = stateRef.current;
      onStateChange({
        ...current,
        viewport: {
          x: target.x(),
          y: target.y(),
          scale: target.scaleX(),
        },
      });
    },
    [onStateChange],
  );

  const handleWheel = useCallback(
    (event: KonvaEventObject<WheelEvent>) => {
      if ((!event.evt.ctrlKey && !event.evt.metaKey) || event.evt.deltaY === 0) {
        return;
      }
      event.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };
      const direction = event.evt.deltaY > 0 ? -1 : 1;
      const rawScale =
        direction > 0 ? oldScale * SCALE_STEP : oldScale / SCALE_STEP;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, rawScale));
      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };
      stage.scale({ x: newScale, y: newScale });
      stage.position(newPos);
      stage.batchDraw();
      setViewportScale(newScale);
      const current = stateRef.current;
      onStateChange({
        ...current,
        viewport: { ...newPos, scale: newScale },
      });
    },
    [onStateChange],
  );

  const handleZoom = useCallback(
    (direction: 1 | -1) => {
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      const oldScale = stage.scaleX();
      const rawScale =
        direction > 0 ? oldScale * SCALE_STEP : oldScale / SCALE_STEP;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, rawScale));
      if (newScale === oldScale) {
        return;
      }
      const center = { x: size.width / 2, y: size.height / 2 };
      const worldCenter = {
        x: (center.x - stage.x()) / oldScale,
        y: (center.y - stage.y()) / oldScale,
      };
      const next = {
        x: center.x - worldCenter.x * newScale,
        y: center.y - worldCenter.y * newScale,
        scale: newScale,
      };
      stage.scale({ x: newScale, y: newScale });
      stage.position({ x: next.x, y: next.y });
      stage.batchDraw();
      setViewportScale(newScale);
      const current = stateRef.current;
      onStateChange({ ...current, viewport: next });
    },
    [onStateChange, size.height, size.width],
  );

  const buildFitViewport = useCallback(
    (positions: DatabaseDiagramVisualState["positions"]) => {
      if (tables.length === 0) {
        return null;
      }

      const bounds = tables.reduce(
        (acc, table) => {
          const pos = positions[table.id];
          if (!pos) {
            return acc;
          }
          const height = computeDatabaseTableHeight(table.columns.length);
          return {
            minX: Math.min(acc.minX, pos.x),
            minY: Math.min(acc.minY, pos.y),
            maxX: Math.max(acc.maxX, pos.x + DB_TABLE_WIDTH),
            maxY: Math.max(acc.maxY, pos.y + height),
          };
        },
        {
          minX: Number.POSITIVE_INFINITY,
          minY: Number.POSITIVE_INFINITY,
          maxX: Number.NEGATIVE_INFINITY,
          maxY: Number.NEGATIVE_INFINITY,
        },
      );
      if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX)) {
        return null;
      }

      const padding = 72;
      const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
      const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
      const nextScale = clamp(
        Math.min(
          (size.width - padding * 2) / contentWidth,
          (size.height - padding * 2) / contentHeight,
        ),
        MIN_SCALE,
        MAX_SCALE,
      );

      return {
        x:
          (size.width - contentWidth * nextScale) / 2 -
          bounds.minX * nextScale,
        y:
          (size.height - contentHeight * nextScale) / 2 -
          bounds.minY * nextScale,
        scale: nextScale,
      };
    },
    [size.height, size.width, tables],
  );

  const applyViewport = useCallback((next: DatabaseDiagramViewport) => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    stage.scale({ x: next.scale, y: next.scale });
    stage.position({ x: next.x, y: next.y });
    stage.batchDraw();
    setViewportScale(next.scale);
  }, []);

  const handleFitToContent = useCallback(() => {
    const current = stateRef.current;
    const next = buildFitViewport(current.positions);
    if (!next) {
      return;
    }
    applyViewport(next);
    onStateChange({ ...current, viewport: next });
  }, [applyViewport, buildFitViewport, onStateChange]);

  const handleApplyAutoLayout = useCallback(
    (algorithm: DatabaseAutoLayoutAlgorithm) => {
      const current = stateRef.current;
      const positions = computeDatabaseAutoLayoutByAlgorithm(
        tables,
        relations,
        algorithm,
      );
      const viewport = buildFitViewport(positions) ?? INITIAL_VIEWPORT;

      setLiveTablePosition(null);
      setLiveRelationPath(null);
      setSelectedTableId(null);
      setSelectedRelationId(null);
      setEditingRelationId(null);
      setActiveEditor(null);
      setIsAutoLayoutOpen(false);
      applyViewport(viewport);
      onStateChange({
        ...current,
        positions,
        relationPaths: undefined,
        viewport,
      });
    },
    [applyViewport, buildFitViewport, onStateChange, relations, tables],
  );

  useEffect(() => {
    if (!isAutoLayoutOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsAutoLayoutOpen(false);
        return;
      }

      const option = AUTO_LAYOUT_OPTIONS.find(
        (entry) => entry.shortcut === event.key,
      );
      if (option) {
        handleApplyAutoLayout(option.id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleApplyAutoLayout, isAutoLayoutOpen]);

  const openTableEditor = useCallback((table: DatabaseTable) => {
    setSelectedTableId(table.id);
    setSelectedRelationId(null);
    setActiveEditor({
      type: "table",
      tableId: table.id,
      draft: table.name,
      error: null,
    });
  }, []);

  const openColumnEditor = useCallback(
    (table: DatabaseTable, columnName: string) => {
      setSelectedTableId(table.id);
      setSelectedRelationId(null);
      setActiveEditor({
        type: "column",
        tableId: table.id,
        columnName,
        draft: columnName,
        error: null,
      });
    },
    [],
  );

  const handleSubmitEditor = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!activeEditor) {
        return;
      }
      const table = tables.find((entry) => entry.id === activeEditor.tableId);
      if (!table) {
        setActiveEditor(null);
        return;
      }

      const nextName = activeEditor.draft.trim();
      if (activeEditor.type === "table") {
        if (!isValidDbmlIdentifier(nextName)) {
          setActiveEditor({
            ...activeEditor,
            error: "Nome de tabela inválido",
          });
          return;
        }
        if (
          nextName !== table.name &&
          tables.some((entry) => entry.name === nextName)
        ) {
          setActiveEditor({ ...activeEditor, error: "Tabela já existe" });
          return;
        }
        const renamed = onRenameTable?.(table.name, nextName) ?? false;
        if (!renamed && nextName !== table.name) {
          setActiveEditor({
            ...activeEditor,
            error: "Não foi possível atualizar o DBML",
          });
          return;
        }
      } else {
        if (!isValidDbmlColumnIdentifier(nextName)) {
          setActiveEditor({
            ...activeEditor,
            error: "Nome de coluna inválido",
          });
          return;
        }
        if (
          nextName !== activeEditor.columnName &&
          table.columns.some((column) => column.name === nextName)
        ) {
          setActiveEditor({ ...activeEditor, error: "Coluna já existe" });
          return;
        }
        const renamed =
          onRenameColumn?.(table.name, activeEditor.columnName, nextName) ??
          false;
        if (!renamed && nextName !== activeEditor.columnName) {
          setActiveEditor({
            ...activeEditor,
            error: "Não foi possível atualizar o DBML",
          });
          return;
        }
      }
      setActiveEditor(null);
    },
    [activeEditor, onRenameColumn, onRenameTable, tables],
  );

  const isDark = theme === "dark";
  const colors = UI_THEME[theme];
  const stageBg = colors.canvas;
  const tableBg = colors.surface;
  const tableBorder = colors.line;
  const headerBg = colors.raised;
  const headerText = colors.heading;
  const rowText = colors.text;
  const typeText = colors.muted;
  const edgeColor = colors.edge;
  const activeEdgeColor = colors.accent;
  const badgeBg = colors.tagBg;
  const badgeText = colors.tag;
  const rowHighlight = colors.accentSoft;
  const selectedBorder = colors.accent;

  const tableLookup = useMemo(() => {
    const map = new Map<string, DatabaseTable>();
    tables.forEach((t) => map.set(t.id, t));
    return map;
  }, [tables]);

  const visualRelationPaths = useMemo(() => {
    if (!liveRelationPath) {
      return state.relationPaths;
    }

    return {
      ...state.relationPaths,
      [liveRelationPath.relationId]: liveRelationPath.path,
    };
  }, [liveRelationPath, state.relationPaths]);

  const activeRelationIds = useMemo(() => {
    if (hoveredRelationId) {
      return new Set([hoveredRelationId]);
    }
    if (hoveredTableId) {
      return new Set(
        relations
          .filter((relation) => relationTouchesTable(relation, hoveredTableId))
          .map((relation) => relation.id),
      );
    }
    if (selectedTableId) {
      return new Set(
        relations
          .filter((relation) => relationTouchesTable(relation, selectedTableId))
          .map((relation) => relation.id),
      );
    }
    if (selectedRelationId) {
      return new Set([selectedRelationId]);
    }
    return new Set<string>();
  }, [
    hoveredRelationId,
    hoveredTableId,
    relations,
    selectedRelationId,
    selectedTableId,
  ]);

  const activeEditorTable = activeEditor
    ? tableLookup.get(activeEditor.tableId)
    : undefined;
  const activeEditorColumnIndex =
    activeEditor?.type === "column" && activeEditorTable
      ? activeEditorTable.columns.findIndex(
          (column) => column.name === activeEditor.columnName,
        )
      : -1;
  const activeEditorPosition =
    activeEditor && activeEditorTable
      ? visualPositions[activeEditorTable.id]
      : undefined;
  const viewport = state.viewport ?? INITIAL_VIEWPORT;
  const editorLeft = activeEditorPosition
    ? clamp(
        activeEditorPosition.x * viewport.scale +
          viewport.x +
          DB_TABLE_WIDTH * viewport.scale +
          12,
        12,
        Math.max(12, size.width - EDITOR_WIDTH - 12),
      )
    : 12;
  const editorTop = activeEditorPosition
    ? clamp(
        activeEditorPosition.y * viewport.scale +
          viewport.y +
          (activeEditor?.type === "column" && activeEditorColumnIndex >= 0
            ? columnYCenter(activeEditorColumnIndex) * viewport.scale - 24
            : 12),
        12,
        Math.max(12, size.height - 190),
      )
    : 12;
  const recordsTable = recordsTableId
    ? tableLookup.get(recordsTableId)
    : undefined;

  return (
    <div
      ref={containerRef}
      className="nexo-surface nexo-canvas-surface relative h-full min-h-[480px] w-full overflow-hidden rounded border border-[var(--ui-line)] bg-[var(--ui-surface)]"
      style={{ backgroundColor: stageBg }}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        draggable={interactionMode === "pan"}
        onDragEnd={handleStageDragEnd}
        onWheel={handleWheel}
        onClick={(event) => {
          if (event.target === event.target.getStage()) {
            setActiveEditor(null);
            setSelectedTableId(null);
            setSelectedRelationId(null);
            setEditingRelationId(null);
          }
        }}
      >
        <Layer>
          {relations.map((rel) => {
            const fromTable = tableLookup.get(rel.fromTable);
            const toTable = tableLookup.get(rel.toTable);
            if (!fromTable || !toTable) {
              return null;
            }
            const fromPos = visualPositions[fromTable.id];
            const toPos = visualPositions[toTable.id];
            if (!fromPos || !toPos) {
              return null;
            }
            const fromColIndex = fromTable.columns.findIndex(
              (c) => c.name === rel.fromColumn,
            );
            const toColIndex = toTable.columns.findIndex(
              (c) => c.name === rel.toColumn,
            );
            if (fromColIndex < 0 || toColIndex < 0) {
              return null;
            }
            const fromHeight = computeDatabaseTableHeight(
              fromTable.columns.length,
            );
            const toHeight = computeDatabaseTableHeight(toTable.columns.length);
            const { fromSide, toSide } = chooseRelationSides(
              fromPos,
              fromHeight,
              toPos,
              toHeight,
            );
            const customPath = visualRelationPaths?.[rel.id];
            const effectiveFromSide = customPath?.fromSide ?? fromSide;
            const effectiveToSide = customPath?.toSide ?? toSide;
            const fromAnchor = getColumnAnchor(
              fromPos,
              fromColIndex,
              effectiveFromSide,
            );
            const toAnchor = getColumnAnchor(
              toPos,
              toColIndex,
              effectiveToSide,
            );
            const fallbackPoints = buildOrthogonalPath(
              fromAnchor,
              effectiveFromSide,
              toAnchor,
              effectiveToSide,
            );
            const points = normalizeRelationPath(
              customPath,
              fallbackPoints,
              fromAnchor,
              toAnchor,
            );
            const isSelected = selectedRelationId === rel.id;
            const isActive = activeRelationIds.has(rel.id);
            const isEditing = editingRelationId === rel.id;
            const isCurveEdge = edgeStyle === "curve";
            const roundedPath = buildOrthogonalPathData(points);
            const defaultCurvePoints = buildCurvePoints(
              fromAnchor,
              effectiveFromSide,
              toAnchor,
              effectiveToSide,
            );
            const curvePoints =
              isCurveEdge && customPath?.points.length === 4
                ? pointArrayToPairs(points)
                : defaultCurvePoints;
            const blocked = isCurveEdge
              ? isDatabaseCurveBlocked(curvePoints, routingObstacles)
              : isDatabasePathBlocked(pointArrayToPairs(points), routingObstacles);
            const routedPoints = blocked ? routeDatabaseConnection(
              fromAnchor, effectiveFromSide, toAnchor, effectiveToSide, routingObstacles,
            ) : null;
            // Não desenhar uma conexão através de tabelas sobrepostas sem corredor livre.
            if (blocked && !routedPoints) return null;
            const relationPath = routedPoints
              ? buildRoutedDatabasePath(routedPoints, isCurveEdge)
              : isCurveEdge
              ? buildCurvePathDataFromPoints(curvePoints)
              : roundedPath;
            const stroke = isActive ? activeEdgeColor : edgeColor;
            const relationMidpoint = routedPoints
              ? buildRelationMidpoint(pointPairsToArray(routedPoints))
              : isCurveEdge
              ? buildCurveMidpoint(curvePoints)
              : buildRelationMidpoint(points);
            const editablePoints = isEditing
              ? isCurveEdge
                ? [curvePoints[0], curvePoints[curvePoints.length - 1]]
                : routedPoints ?? pointArrayToPairs(points)
              : [];
            const segmentHandles =
              isEditing && !isCurveEdge
                ? buildSegmentHandles(editablePoints)
                : [];
            const guidePoints =
              isEditing && !isCurveEdge
                ? buildRelationGuidePoints(editablePoints)
                : [];
            const staticControlPoints: { x: number; y: number }[] = [];
            const curveControlPoints =
              isEditing && isCurveEdge ? curvePoints.slice(1, 3) : [];
            return (
              <Group key={rel.id}>
                {isSelected ? (
                  <Path
                    data={relationPath}
                    stroke={activeEdgeColor}
                    strokeWidth={5}
                    lineCap={isCurveEdge ? "round" : "butt"}
                    lineJoin={isCurveEdge ? "round" : "miter"}
                    opacity={0.12}
                    perfectDrawEnabled={false}
                    listening={false}
                    shadowForStrokeEnabled={false}
                  />
                ) : null}
                <Path
                  data={relationPath}
                  stroke={stroke}
                  strokeWidth={1.6}
                  lineCap={isCurveEdge ? "round" : "butt"}
                  lineJoin={isCurveEdge ? "round" : "miter"}
                  opacity={isActive ? 1 : 0.86}
                  perfectDrawEnabled={false}
                  shadowForStrokeEnabled={false}
                  listening={false}
                />
                {staticControlPoints.map((point, index) => (
                  <Circle
                    key={`static-${point.x}-${point.y}-${index}`}
                    x={point.x}
                    y={point.y}
                    radius={2.15}
                    fill={stroke}
                    opacity={0.9}
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                ))}
                {guidePoints.map((point, index) => (
                  <Circle
                    key={`guide-${rel.id}-${index}`}
                    x={point.x}
                    y={point.y}
                    radius={1.75}
                    fill={activeEdgeColor}
                    opacity={0.72}
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                ))}
                {editablePoints.map((point, pointIndex) => {
                  const isEndpoint =
                    pointIndex === 0 ||
                    pointIndex === editablePoints.length - 1;
                  const buildEndpointDragPath = (
                    dragX: number,
                  ): DatabaseRelationPathState | null => {
                    if (!isEndpoint) {
                      return null;
                    }

                    if (pointIndex === 0) {
                      const nextSide: DatabaseRelationSide =
                        dragX < fromPos.x + DB_TABLE_WIDTH / 2
                          ? "left"
                          : "right";
                      const nextFromAnchor = getColumnAnchor(
                        fromPos,
                        fromColIndex,
                        nextSide,
                      );
                      return {
                        fromSide: nextSide,
                        toSide: effectiveToSide,
                        points: isCurveEdge
                          ? buildCurvePoints(
                              nextFromAnchor,
                              nextSide,
                              toAnchor,
                              effectiveToSide,
                            )
                          : pointArrayToPairs(
                              buildOrthogonalPath(
                                nextFromAnchor,
                                nextSide,
                                toAnchor,
                                effectiveToSide,
                              ),
                            ),
                      };
                    }

                    if (pointIndex === editablePoints.length - 1) {
                      const nextSide: DatabaseRelationSide =
                        dragX < toPos.x + DB_TABLE_WIDTH / 2
                          ? "left"
                          : "right";
                      const nextToAnchor = getColumnAnchor(
                        toPos,
                        toColIndex,
                        nextSide,
                      );
                      return {
                        fromSide: effectiveFromSide,
                        toSide: nextSide,
                        points: isCurveEdge
                          ? buildCurvePoints(
                              fromAnchor,
                              effectiveFromSide,
                              nextToAnchor,
                              nextSide,
                            )
                          : pointArrayToPairs(
                              buildOrthogonalPath(
                                fromAnchor,
                                effectiveFromSide,
                                nextToAnchor,
                                nextSide,
                              ),
                            ),
                      };
                    }

                    return null;
                  };
                  return (
                    <Circle
                      key={`edit-${rel.id}-${pointIndex}`}
                      x={point.x}
                      y={point.y}
                      radius={isEndpoint ? 5 : 2.3}
                      fill={isEndpoint ? colors.surface : activeEdgeColor}
                      stroke={colors.accent}
                      strokeWidth={isEndpoint ? 2 : 0}
                      draggable={isEndpoint}
                      onDragMove={(event) => {
                        event.cancelBubble = true;
                        const nextPath = buildEndpointDragPath(
                          event.target.x(),
                        );
                        if (nextPath) {
                          previewRelationPath(rel.id, nextPath);
                        }
                      }}
                      onDragEnd={(event) => {
                        event.cancelBubble = true;
                        const nextPath = buildEndpointDragPath(
                          event.target.x(),
                        );
                        if (nextPath) {
                          commitRelationPath(rel.id, nextPath);
                        }
                      }}
                      onMouseEnter={(event) => {
                        const stage = event.target.getStage();
                        if (stage) {
                          stage.container().style.cursor = "move";
                        }
                      }}
                      onMouseLeave={(event) => {
                        const stage = event.target.getStage();
                        if (stage) {
                          stage.container().style.cursor = "default";
                        }
                      }}
                      perfectDrawEnabled={false}
                    />
                  );
                })}
                {curveControlPoints.map((point, controlIndex) => {
                  const buildCurveControlPath = (
                    x: number,
                    y: number,
                  ): DatabaseRelationPathState => {
                    const snapshot =
                      curveDragSnapshotRef.current?.relationId === rel.id &&
                      curveDragSnapshotRef.current.controlIndex ===
                        controlIndex + 1
                        ? curveDragSnapshotRef.current.points
                        : curvePoints;
                    const nextCurvePoints = moveLinkedCurveControlPoints(
                      snapshot,
                      controlIndex + 1,
                      { x, y },
                    );
                    return {
                      fromSide: effectiveFromSide,
                      toSide: effectiveToSide,
                      points: nextCurvePoints,
                    };
                  };

                  return (
                    <Circle
                      key={`curve-control-${rel.id}-${controlIndex}`}
                      x={point.x}
                      y={point.y}
                      radius={5}
                      fill={colors.surface}
                      stroke={colors.accent}
                      strokeWidth={2}
                      draggable
                      onDragStart={() => {
                        curveDragSnapshotRef.current = {
                          relationId: rel.id,
                          controlIndex: controlIndex + 1,
                          points: curvePoints.map((entry) => ({ ...entry })),
                        };
                      }}
                      onDragMove={(event) => {
                        event.cancelBubble = true;
                        previewRelationPath(
                          rel.id,
                          buildCurveControlPath(
                            event.target.x(),
                            event.target.y(),
                          ),
                        );
                      }}
                      onDragEnd={(event) => {
                        event.cancelBubble = true;
                        commitRelationPath(
                          rel.id,
                          buildCurveControlPath(
                            event.target.x(),
                            event.target.y(),
                          ),
                        );
                      }}
                      onMouseEnter={(event) => {
                        const stage = event.target.getStage();
                        if (stage) {
                          stage.container().style.cursor = "move";
                        }
                      }}
                      onMouseLeave={(event) => {
                        const stage = event.target.getStage();
                        if (stage) {
                          stage.container().style.cursor = "default";
                        }
                      }}
                      perfectDrawEnabled={false}
                    />
                  );
                })}
                {segmentHandles.map((handle) => {
                  const buildSegmentPath = (
                    x: number,
                    y: number,
                  ): DatabaseRelationPathState => ({
                    fromSide: effectiveFromSide,
                    toSide: effectiveToSide,
                    points: moveRelationSegment(editablePoints, handle.index, {
                      x,
                      y,
                    }),
                  });

                  return (
                    <Circle
                      key={`segment-${rel.id}-${handle.index}`}
                      x={handle.x}
                      y={handle.y}
                      radius={5}
                      fill={colors.surface}
                      stroke={colors.accent}
                      strokeWidth={2}
                      draggable
                      onDragMove={(event) => {
                        event.cancelBubble = true;
                        previewRelationPath(
                          rel.id,
                          buildSegmentPath(event.target.x(), event.target.y()),
                        );
                      }}
                      onDragEnd={(event) => {
                        event.cancelBubble = true;
                        commitRelationPath(
                          rel.id,
                          buildSegmentPath(event.target.x(), event.target.y()),
                        );
                      }}
                      onMouseEnter={(event) => {
                        const stage = event.target.getStage();
                        if (stage) {
                          stage.container().style.cursor =
                            handle.orientation === "vertical"
                              ? "ew-resize"
                              : "ns-resize";
                        }
                      }}
                      onMouseLeave={(event) => {
                        const stage = event.target.getStage();
                        if (stage) {
                          stage.container().style.cursor = "default";
                        }
                      }}
                      perfectDrawEnabled={false}
                    />
                  );
                })}
                {isEditing ? (
                  <Group
                    x={relationMidpoint.x - 18}
                    y={relationMidpoint.y - 18}
                    onClick={(event) => {
                      event.cancelBubble = true;
                      resetRelationPath(rel.id);
                    }}
                    onMouseEnter={(event) => {
                      const stage = event.target.getStage();
                      if (stage) {
                        stage.container().style.cursor = "pointer";
                      }
                    }}
                    onMouseLeave={(event) => {
                      const stage = event.target.getStage();
                      if (stage) {
                        stage.container().style.cursor = "default";
                      }
                    }}
                  >
                    <Rect
                      width={18}
                      height={18}
                      cornerRadius={UI_RADIUS}
                      fill={colors.surface}
                      stroke={colors.accent}
                      strokeWidth={1}
                      shadowColor={colors.shadowColor}
                      shadowBlur={4}
                      shadowOpacity={0.35}
                      perfectDrawEnabled={false}
                    />
                    <Text
                      x={0}
                      y={1}
                      width={18}
                      height={18}
                      align="center"
                      verticalAlign="middle"
                      text="C"
                      fontSize={14}
                      fontStyle="700"
                      fontFamily={UI_FONT_FAMILY}
                      fill={colors.accent}
                      perfectDrawEnabled={false}
                    />
                  </Group>
                ) : null}
                <CardinalityMarker
                  anchor={fromAnchor}
                  side={effectiveFromSide}
                  label={rel.cardinalityLabelFrom}
                  color={stroke}
                  strokeWidth={isActive ? 1.6 : 1.2}
                  opacity={isActive ? 1 : 0.85}
                />
                <CardinalityMarker
                  anchor={toAnchor}
                  side={effectiveToSide}
                  label={rel.cardinalityLabelTo}
                  color={stroke}
                  strokeWidth={isActive ? 1.6 : 1.2}
                  opacity={isActive ? 1 : 0.85}
                />
                {isActive && rel.name ? (
                  <Text
                    x={relationMidpoint.x - 52}
                    y={relationMidpoint.y - 26}
                    width={96}
                    align="center"
                    text={rel.name}
                    fontSize={12}
                    fontStyle="500"
                    fontFamily={UI_FONT_FAMILY}
                    fill={activeEdgeColor}
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                ) : null}
                <Path
                  data={relationPath}
                  stroke="transparent"
                  strokeWidth={16}
                  lineCap={isCurveEdge ? "round" : "butt"}
                  lineJoin={isCurveEdge ? "round" : "miter"}
                  listening={!isEditing}
                  perfectDrawEnabled={false}
                  shadowForStrokeEnabled={false}
                  onClick={(event) => {
                    event.cancelBubble = true;
                    setSelectedRelationId(rel.id);
                    setSelectedTableId(null);
                    setActiveEditor(null);
                  }}
                  onDblClick={(event) => {
                    event.cancelBubble = true;
                    setEditingRelationId(rel.id);
                    setSelectedRelationId(rel.id);
                    setSelectedTableId(null);
                    setActiveEditor(null);
                    if (!customPath) {
                      saveRelationPath(rel.id, {
                        fromSide: effectiveFromSide,
                        toSide: effectiveToSide,
                        points: isCurveEdge
                          ? curvePoints
                          : pointArrayToPairs(points),
                      });
                    }
                  }}
                  onDblTap={(event) => {
                    event.cancelBubble = true;
                    setEditingRelationId(rel.id);
                    setSelectedRelationId(rel.id);
                    setSelectedTableId(null);
                    setActiveEditor(null);
                    if (!customPath) {
                      saveRelationPath(rel.id, {
                        fromSide: effectiveFromSide,
                        toSide: effectiveToSide,
                        points: isCurveEdge
                          ? curvePoints
                          : pointArrayToPairs(points),
                      });
                    }
                  }}
                  onMouseEnter={(event) => {
                    setHoveredRelationId(rel.id);
                    const stage = event.target.getStage();
                    if (stage) {
                      stage.container().style.cursor = "pointer";
                    }
                  }}
                  onMouseLeave={(event) => {
                    setHoveredRelationId((current) =>
                      current === rel.id ? null : current,
                    );
                    const stage = event.target.getStage();
                    if (stage) {
                      stage.container().style.cursor = "default";
                    }
                  }}
                />
              </Group>
            );
          })}
        </Layer>

        <Layer>
          {tables.map((table) => {
            const pos = visualPositions[table.id];
            if (!pos) {
              return null;
            }
            const height = computeDatabaseTableHeight(table.columns.length);
            const isTableSelected = selectedTableId === table.id;
            return (
              <Group
                key={table.id}
                x={pos.x}
                y={pos.y}
                draggable
                onClick={(event) => {
                  event.cancelBubble = true;
                  setSelectedTableId(table.id);
                  setSelectedRelationId(null);
                  setEditingRelationId(null);
                }}
                onDragMove={(event) => handleTableDragMove(table.id, event)}
                onDragEnd={(event) => handleTableDragEnd(table.id, event)}
                onMouseEnter={(event) => {
                  setHoveredTableId(table.id);
                  const stage = event.target.getStage();
                  if (stage) {
                    stage.container().style.cursor = "grab";
                  }
                }}
                onMouseLeave={(event) => {
                  setHoveredTableId((current) =>
                    current === table.id ? null : current,
                  );
                  const stage = event.target.getStage();
                  if (stage) {
                    stage.container().style.cursor = "default";
                  }
                }}
              >
                <Rect
                  width={DB_TABLE_WIDTH}
                  height={height}
                  cornerRadius={UI_RADIUS}
                  fill={tableBg}
                  stroke={isTableSelected ? selectedBorder : tableBorder}
                  strokeWidth={isTableSelected ? 1.5 : 1}
                  shadowColor={colors.shadowColor}
                  shadowBlur={isTableSelected ? 10 : 6}
                  shadowOpacity={isTableSelected ? 0.28 : isDark ? 0.4 : 0.15}
                  shadowOffsetY={2}
                  perfectDrawEnabled={false}
                />
                <Rect
                  width={DB_TABLE_WIDTH}
                  height={DB_HEADER_HEIGHT}
                  cornerRadius={[UI_RADIUS, UI_RADIUS, 0, 0]}
                  fill={headerBg}
                  perfectDrawEnabled={false}
                />
                <Text
                  x={12}
                  y={9}
                  width={DB_TABLE_WIDTH - (table.records ? 72 : 24)}
                  text={table.name}
                  fontSize={13}
                  fontStyle="600"
                  fontFamily={UI_FONT_FAMILY}
                  fill={headerText}
                  ellipsis
                  onClick={(event) => {
                    event.cancelBubble = true;
                    openTableEditor(table);
                  }}
                  onMouseEnter={(event) => {
                    const stage = event.target.getStage();
                    if (stage) {
                      stage.container().style.cursor = "text";
                    }
                  }}
                  onMouseLeave={(event) => {
                    const stage = event.target.getStage();
                    if (stage) {
                      stage.container().style.cursor = "default";
                    }
                  }}
                  perfectDrawEnabled={false}
                />
                {table.records && table.records.rows.length > 0 ? (
                  <Text
                    x={DB_TABLE_WIDTH - 52}
                    y={9}
                    width={40}
                    align="right"
                    text="REC"
                    fontSize={10}
                    fontStyle="700"
                    fontFamily={UI_FONT_FAMILY}
                    fill={colors.tag}
                    onClick={(event) => {
                      event.cancelBubble = true;
                      setRecordsTableId(table.id);
                    }}
                    perfectDrawEnabled={false}
                  />
                ) : null}
                {table.columns.map((column, colIdx) => {
                  const y = DB_HEADER_HEIGHT + colIdx * DB_ROW_HEIGHT;
                  const isLastRow = colIdx === table.columns.length - 1;
                  const flagsX = DB_TABLE_WIDTH - 12;
                  const badges = [
                    column.isPrimaryKey ? "PK" : null,
                    column.isForeignKey ? "FK" : null,
                    column.isNotNull ? "NN" : null,
                  ].filter((badge): badge is string => badge !== null);
                  const isHighlighted = relations.some(
                    (relation) =>
                      activeRelationIds.has(relation.id) &&
                      isRelationEndpoint(relation, table.id, column.name),
                  );
                  const isColumnEditing =
                    activeEditor?.type === "column" &&
                    activeEditor.tableId === table.id &&
                    activeEditor.columnName === column.name;
                  const reservedBadgeWidth =
                    badges.length > 0 ? badges.length * 26 - 4 : 0;
                  return (
                    <Group
                      key={column.id}
                      y={y}
                      onClick={(event) => {
                        event.cancelBubble = true;
                        openColumnEditor(table, column.name);
                      }}
                    >
                      {(isHighlighted || isColumnEditing) && (
                        <Rect
                          width={DB_TABLE_WIDTH}
                          height={DB_ROW_HEIGHT}
                          fill={rowHighlight}
                          opacity={isColumnEditing ? 0.9 : 0.7}
                          perfectDrawEnabled={false}
                        />
                      )}
                      {!isLastRow && (
                        <Line
                          points={[
                            8,
                            DB_ROW_HEIGHT,
                            DB_TABLE_WIDTH - 8,
                            DB_ROW_HEIGHT,
                          ]}
                          stroke={tableBorder}
                          strokeWidth={0.5}
                          opacity={0.6}
                          perfectDrawEnabled={false}
                        />
                      )}
                      <Text
                        x={12}
                        y={(DB_ROW_HEIGHT - 12) / 2}
                        text={column.name}
                        fontSize={12}
                        fontStyle={column.isPrimaryKey ? "600" : "400"}
                        fontFamily={UI_FONT_FAMILY}
                        fill={rowText}
                        onMouseEnter={(event) => {
                          const stage = event.target.getStage();
                          if (stage) {
                            stage.container().style.cursor = "text";
                          }
                        }}
                        onMouseLeave={(event) => {
                          const stage = event.target.getStage();
                          if (stage) {
                            stage.container().style.cursor = "default";
                          }
                        }}
                        perfectDrawEnabled={false}
                      />
                      <Text
                        x={DB_TABLE_WIDTH / 2}
                        y={(DB_ROW_HEIGHT - 12) / 2}
                        width={DB_TABLE_WIDTH / 2 - 16 - reservedBadgeWidth}
                        align="right"
                        text={column.type}
                        fontSize={11}
                        fontFamily={UI_CODE_FONT_FAMILY}
                        fill={typeText}
                        ellipsis
                        perfectDrawEnabled={false}
                      />
                      {badges.map((badge, badgeIndex) => (
                        <Group
                          key={badge}
                          x={
                            flagsX -
                            badges.length * 22 -
                            (badges.length - 1) * 4 +
                            badgeIndex * 26
                          }
                          y={(DB_ROW_HEIGHT - 14) / 2}
                        >
                          <Rect
                            width={22}
                            height={14}
                            cornerRadius={UI_RADIUS}
                            fill={badgeBg}
                            perfectDrawEnabled={false}
                          />
                          <Text
                            x={0}
                            y={2}
                            width={22}
                            align="center"
                            text={badge}
                            fontSize={9}
                            fontStyle="700"
                            fontFamily={UI_FONT_FAMILY}
                            fill={badgeText}
                            perfectDrawEnabled={false}
                          />
                        </Group>
                      ))}
                    </Group>
                  );
                })}
              </Group>
            );
          })}
        </Layer>
      </Stage>

      {tables.length === 0 ? (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[var(--ui-muted)]"
        >
          Escreva DBML no editor à esquerda para visualizar as tabelas.
        </div>
      ) : null}

      {activeEditor && activeEditorTable ? (
        <form
          onSubmit={handleSubmitEditor}
          className="absolute z-50 rounded border p-3 shadow-[var(--ui-shadow)] border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-heading)]"
          style={{ left: editorLeft, top: editorTop, width: EDITOR_WIDTH }}
        >
          <label
            htmlFor="database-editor-name"
            className="mb-2 block text-[11px] font-semibold text-[var(--ui-muted)]"
          >
            {activeEditor.type === "table" ? "Table Name" : "Column Name"}
          </label>
          <input
            id="database-editor-name"
            value={activeEditor.draft}
            autoFocus
            onChange={(event) =>
              setActiveEditor({
                ...activeEditor,
                draft: event.target.value,
                error: null,
              })
            }
            className="w-full rounded border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ui-accent)] border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-heading)]"
          />
          {activeEditor.error ? (
            <p className="mt-2 text-xs text-[var(--ui-danger)]">{activeEditor.error}</p>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-2">
            {activeEditor.type === "table" &&
            activeEditorTable.records &&
            activeEditorTable.records.rows.length > 0 ? (
              <button
                type="button"
                onClick={() => setRecordsTableId(activeEditorTable.id)}
                className="rounded px-2 py-1 text-xs font-medium bg-[var(--ui-raised)] text-[var(--ui-text)] hover:bg-[var(--ui-raised)]"
              >
                Ver records
              </button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveEditor(null)}
                className="rounded px-2 py-1 text-xs text-[var(--ui-muted)] hover:bg-[var(--ui-raised)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded bg-[var(--ui-primary)] px-2 py-1 text-xs font-semibold text-[var(--ui-on-primary)] hover:bg-[var(--ui-primary-hover)]"
              >
                Salvar
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {recordsTable?.records ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="database-records-title"
            className="max-h-full w-full max-w-4xl overflow-hidden rounded border shadow-[var(--ui-shadow)] border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-heading)]"
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3 border-[var(--ui-line)]"
            >
              <h2 id="database-records-title" className="text-sm font-semibold">
                Records de {recordsTable.name}
              </h2>
              <button
                type="button"
                onClick={() => setRecordsTableId(null)}
                className="rounded px-2 py-1 text-sm hover:bg-[var(--ui-raised)]"
              >
                Fechar
              </button>
            </div>
            <div className="max-h-[65vh] overflow-auto p-4">
              <table className="min-w-full border-collapse text-left text-xs">
                <thead>
                  <tr>
                    {recordsTable.records.columns.map((column) => (
                      <th
                        key={column.name}
                        className="border px-3 py-2 font-semibold border-[var(--ui-line)] bg-[var(--ui-surface)]"
                      >
                        {column.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recordsTable.records.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {recordsTable.records?.columns.map((column, colIndex) => (
                        <td
                          key={`${rowIndex}-${column.name}`}
                          className="border px-3 py-2 border-[var(--ui-line)]"
                        >
                          {row[colIndex] ?? "(null)"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {isAutoLayoutOpen ? (
        <div
          role="dialog"
          aria-label="Escolher algoritmo de auto-organização"
          className="absolute bottom-16 left-4 z-50 w-[min(28rem,calc(100%-2rem))] overflow-hidden rounded border shadow-[var(--ui-shadow)] border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-heading)]"
        >
          <div
            className="border-b px-4 py-3 text-sm font-semibold border-[var(--ui-line)]"
          >
            Escolha o algoritmo de auto-organização
          </div>
          <div className="p-2">
            {AUTO_LAYOUT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleApplyAutoLayout(option.id)}
                className="flex w-full items-start gap-4 rounded px-3 py-3 text-left transition hover:bg-[var(--ui-raised)]"
              >
                <span
                  className="mt-1 shrink-0 text-[var(--ui-text)]"
                >
                  <AutoLayoutIcon icon={option.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {option.label}
                  </span>
                  <span
                    className="mt-1 block text-xs leading-5 text-[var(--ui-muted)]"
                  >
                    {option.description}
                  </span>
                </span>
                <span
                  className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded border text-xs font-semibold shadow-[var(--ui-shadow)] border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-muted)]"
                  aria-hidden="true"
                >
                  {option.shortcut}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        className="absolute bottom-4 left-4 z-40 flex items-center overflow-hidden rounded border shadow-[var(--ui-shadow)] border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-text)]"
      >
        <button
          type="button"
          onClick={() => handleZoom(-1)}
          disabled={viewportScale <= MIN_SCALE}
          className="flex h-9 w-9 items-center justify-center text-base font-semibold transition hover:bg-[var(--ui-raised)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Diminuir zoom"
          title="Diminuir zoom"
        >
          -
        </button>
        <div
          className="border-x px-3 py-2 text-[11px] font-semibold tabular-nums border-[var(--ui-line)]"
          title="Zoom: Ctrl/⌘ + rolagem ou botões − e +"
        >
          {Math.round(viewportScale * 100)}%
        </div>
        <button
          type="button"
          onClick={() => handleZoom(1)}
          disabled={viewportScale >= MAX_SCALE}
          className="flex h-9 w-9 items-center justify-center text-base font-semibold transition hover:bg-[var(--ui-raised)] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Aumentar zoom"
          title="Aumentar zoom"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setIsAutoLayoutOpen((current) => !current)}
          aria-expanded={isAutoLayoutOpen}
          className={`border-l px-3 py-2 text-xs font-semibold transition ${
            isAutoLayoutOpen
              ? "bg-[var(--ui-primary)] text-[var(--ui-on-primary)]"
              : "border-[var(--ui-line)] hover:bg-[var(--ui-raised)]"
          }`}
        >
          Organizar
        </button>
        <button
          type="button"
          onClick={handleFitToContent}
          className="border-l px-3 py-2 text-xs font-semibold transition border-[var(--ui-line)] hover:bg-[var(--ui-raised)]"
        >
          Ajustar
        </button>
        <button
          type="button"
          onClick={() =>
            setInteractionMode((current) =>
              current === "pan" ? "select" : "pan",
            )
          }
          aria-pressed={interactionMode === "pan"}
          aria-label={interactionMode === "pan" ? "Mover canvas" : "Selecionar"}
          title={interactionMode === "pan" ? "Mover canvas" : "Selecionar"}
          className={`border-l px-3 py-2 text-xs font-semibold transition ${
            interactionMode === "pan"
              ? "bg-[var(--ui-primary)] text-[var(--ui-on-primary)]"
              : "border-[var(--ui-line)] hover:bg-[var(--ui-raised)]"
          }`}
        >
          <HandIcon />
        </button>
      </div>
    </div>
  );
}
