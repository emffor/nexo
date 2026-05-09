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

import type { AppTheme } from "../../lib/preferences";
import {
  isValidDbmlColumnIdentifier,
  isValidDbmlIdentifier,
} from "../../lib/dbml";
import {
  DB_HEADER_HEIGHT,
  DB_ROW_HEIGHT,
  DB_TABLE_PADDING_BOTTOM,
  DB_TABLE_WIDTH,
  computeDatabaseAutoLayout,
  computeDatabaseTableHeight,
  ensureTablePositions,
} from "../../lib/databaseLayout";
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
  const handle = 76;

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
  const midX = (fromHandle.x + toHandle.x) / 2;
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

  if (horizontalOverlap || !verticalOverlap) {
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

function getPointAt(points: number[], index: number): { x: number; y: number } {
  return { x: points[index], y: points[index + 1] };
}

function buildRoundedPathData(points: number[], radius = 12): string {
  if (points.length < 4) {
    return "";
  }

  const lastIndex = points.length - 2;
  let data = `M ${points[0]} ${points[1]}`;

  for (let index = 2; index < lastIndex; index += 2) {
    const previous = getPointAt(points, index - 2);
    const current = getPointAt(points, index);
    const next = getPointAt(points, index + 2);
    const incomingLength = Math.hypot(
      current.x - previous.x,
      current.y - previous.y,
    );
    const outgoingLength = Math.hypot(next.x - current.x, next.y - current.y);
    const cornerRadius = Math.min(
      radius,
      incomingLength / 2,
      outgoingLength / 2,
    );

    if (cornerRadius <= 0) {
      data += ` L ${current.x} ${current.y}`;
      continue;
    }

    const beforeCorner = {
      x: current.x + ((previous.x - current.x) / incomingLength) * cornerRadius,
      y: current.y + ((previous.y - current.y) / incomingLength) * cornerRadius,
    };
    const afterCorner = {
      x: current.x + ((next.x - current.x) / outgoingLength) * cornerRadius,
      y: current.y + ((next.y - current.y) / outgoingLength) * cornerRadius,
    };

    data += ` L ${beforeCorner.x} ${beforeCorner.y}`;
    data += ` Q ${current.x} ${current.y} ${afterCorner.x} ${afterCorner.y}`;
  }

  data += ` L ${points[lastIndex]} ${points[lastIndex + 1]}`;
  return data;
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
  resetSignal = 0,
}: DatabaseDiagramPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const lastResetRef = useRef(resetSignal);
  const stateRef = useRef(state);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [viewportScale, setViewportScale] = useState(
    state.viewport?.scale ?? INITIAL_VIEWPORT.scale,
  );
  const [interactionMode, setInteractionMode] =
    useState<InteractionMode>("select");
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

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // medir container
  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // garantir posições para novas tabelas
  useEffect(() => {
    const next = ensureTablePositions(tables, state.positions);
    if (next !== state.positions) {
      onStateChange({ ...state, positions: next });
    }
  }, [tables, state, onStateChange]);

  // remover posições órfãs
  useEffect(() => {
    const validIds = new Set(tables.map((t) => t.id));
    const filtered: typeof state.positions = {};
    let changed = false;
    for (const [key, value] of Object.entries(state.positions)) {
      if (validIds.has(key)) {
        filtered[key] = value;
      } else {
        changed = true;
      }
    }
    if (changed) {
      onStateChange({ ...state, positions: filtered });
    }
  }, [tables, state, onStateChange]);

  useEffect(() => {
    const validIds = new Set(tables.map((table) => table.id));
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
  }, [
    activeEditor,
    editingRelationId,
    hoveredTableId,
    liveTablePosition,
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
      const x = Math.round(node.x());
      const y = Math.round(node.y());
      node.position({ x, y });
      setLiveTablePosition({ id, x, y });
      const current = stateRef.current;
      onStateChange({
        ...current,
        positions: { ...current.positions, [id]: { x, y } },
      });
    },
    [onStateChange],
  );

  const handleTableDragMove = useCallback(
    (id: string, event: KonvaEventObject<DragEvent>) => {
      const node = event.target;
      setLiveTablePosition({
        id,
        x: Math.round(node.x()),
        y: Math.round(node.y()),
      });
    },
    [],
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

  const resetRelationPath = useCallback(
    (relationId: string) => {
      const current = stateRef.current;
      if (!current.relationPaths?.[relationId]) {
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

  const handleFitToContent = useCallback(() => {
    const stage = stageRef.current;
    if (!stage || tables.length === 0) {
      return;
    }
    const current = stateRef.current;
    const bounds = tables.reduce(
      (acc, table) => {
        const pos = current.positions[table.id];
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
      return;
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
    const next = {
      x: (size.width - contentWidth * nextScale) / 2 - bounds.minX * nextScale,
      y:
        (size.height - contentHeight * nextScale) / 2 - bounds.minY * nextScale,
      scale: nextScale,
    };
    stage.scale({ x: next.scale, y: next.scale });
    stage.position({ x: next.x, y: next.y });
    stage.batchDraw();
    setViewportScale(next.scale);
    onStateChange({ ...current, viewport: next });
  }, [onStateChange, size.height, size.width, tables]);

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
  const stageBg = isDark ? "#080d15" : "#f7f7f7";
  const tableBg = isDark ? "#101827" : "#ffffff";
  const tableBorder = isDark ? "#1f2d3d" : "#d8dde4";
  const headerBg = isDark ? "#244394" : "#2f6f9f";
  const headerText = "#ffffff";
  const rowText = isDark ? "#d8dee9" : "#263238";
  const typeText = isDark ? "#8f9bad" : "#66727f";
  const edgeColor = isDark ? "#64748b" : "#b7bdc6";
  const activeEdgeColor = isDark ? "#60a5fa" : "#2f7ebd";
  const badgeBg = isDark ? "#243247" : "#e8ecef";
  const badgeText = isDark ? "#d7e1ef" : "#4a5562";
  const rowHighlight = isDark ? "#17263c" : "#dceff7";
  const selectedBorder = "#60a5fa";

  const tableLookup = useMemo(() => {
    const map = new Map<string, DatabaseTable>();
    tables.forEach((t) => map.set(t.id, t));
    return map;
  }, [tables]);

  const visualPositions = useMemo(() => {
    if (!liveTablePosition) {
      return state.positions;
    }

    return {
      ...state.positions,
      [liveTablePosition.id]: {
        x: liveTablePosition.x,
        y: liveTablePosition.y,
      },
    };
  }, [liveTablePosition, state.positions]);

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
      className={`relative h-full min-h-[480px] w-full overflow-hidden rounded-[1.25rem] border ${
        isDark ? "border-white/10 bg-ink/60" : "border-slate-200 bg-white"
      }`}
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
            const customPath = state.relationPaths?.[rel.id];
            const effectiveFromSide = customPath?.fromSide ?? fromSide;
            const effectiveToSide = customPath?.toSide ?? toSide;
            const fromAnchor = getColumnAnchor(
              fromPos,
              fromColIndex,
              effectiveFromSide,
            );
            const toAnchor = getColumnAnchor(toPos, toColIndex, effectiveToSide);
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
            const roundedPath = buildRoundedPathData(points);
            const isSelected = selectedRelationId === rel.id;
            const isActive = activeRelationIds.has(rel.id);
            const isEditing = editingRelationId === rel.id;
            const stroke = isActive ? activeEdgeColor : edgeColor;
            const relationMidpoint = buildRelationMidpoint(points);
            const editablePoints = isEditing ? pointArrayToPairs(points) : [];
            const segmentHandles = isEditing
              ? buildSegmentHandles(editablePoints)
              : [];
            const guidePoints = isEditing
              ? buildRelationGuidePoints(editablePoints)
              : [];
            const staticControlPoints = isActive
              ? buildPathControlPoints(points)
              : [];
            return (
              <Group key={rel.id}>
                {isActive ? (
                  <Path
                    data={roundedPath}
                    stroke={activeEdgeColor}
                    strokeWidth={6}
                    lineCap="round"
                    lineJoin="round"
                    opacity={isSelected ? 0.2 : 0.12}
                    perfectDrawEnabled={false}
                    listening={false}
                    shadowForStrokeEnabled={false}
                  />
                ) : null}
                <Path
                  data={roundedPath}
                  stroke={stroke}
                  strokeWidth={isActive ? 2.4 : 1.35}
                  lineCap="round"
                  lineJoin="round"
                  opacity={isActive ? 1 : 0.82}
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
                    pointIndex === 0 || pointIndex === editablePoints.length - 1;
                  return (
                    <Circle
                      key={`edit-${rel.id}-${pointIndex}`}
                      x={point.x}
                      y={point.y}
                      radius={isEndpoint ? 5 : 2.3}
                      fill={isEndpoint ? "#ffffff" : activeEdgeColor}
                      stroke={isEndpoint ? "#6366f1" : "#2563eb"}
                      strokeWidth={isEndpoint ? 2 : 0}
                      draggable={isEndpoint}
                      onDragMove={(event) => {
                        event.cancelBubble = true;
                        if (!isEndpoint) {
                          return;
                        }
                        const node = event.target;
                        if (pointIndex === 0) {
                          const nextSide: DatabaseRelationSide =
                            node.x() < fromPos.x + DB_TABLE_WIDTH / 2
                              ? "left"
                              : "right";
                          const nextFromAnchor = getColumnAnchor(
                            fromPos,
                            fromColIndex,
                            nextSide,
                          );
                          const nextPoints = buildOrthogonalPath(
                            nextFromAnchor,
                            nextSide,
                            toAnchor,
                            effectiveToSide,
                          );
                          saveRelationPath(rel.id, {
                            fromSide: nextSide,
                            toSide: effectiveToSide,
                            points: pointArrayToPairs(nextPoints),
                          });
                          return;
                        }

                        if (pointIndex === editablePoints.length - 1) {
                          const nextSide: DatabaseRelationSide =
                            node.x() < toPos.x + DB_TABLE_WIDTH / 2
                              ? "left"
                              : "right";
                          const nextToAnchor = getColumnAnchor(
                            toPos,
                            toColIndex,
                            nextSide,
                          );
                          const nextPoints = buildOrthogonalPath(
                            fromAnchor,
                            effectiveFromSide,
                            nextToAnchor,
                            nextSide,
                          );
                          saveRelationPath(rel.id, {
                            fromSide: effectiveFromSide,
                            toSide: nextSide,
                            points: pointArrayToPairs(nextPoints),
                          });
                          return;
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
                {segmentHandles.map((handle) => (
                  <Circle
                    key={`segment-${rel.id}-${handle.index}`}
                    x={handle.x}
                    y={handle.y}
                    radius={5}
                    fill="#ffffff"
                    stroke="#6366f1"
                    strokeWidth={2}
                    draggable
                    onDragMove={(event) => {
                      event.cancelBubble = true;
                      const node = event.target;
                      const nextPoints = moveRelationSegment(
                        editablePoints,
                        handle.index,
                        { x: node.x(), y: node.y() },
                      );
                      saveRelationPath(rel.id, {
                        fromSide: effectiveFromSide,
                        toSide: effectiveToSide,
                        points: nextPoints,
                      });
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
                ))}
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
                      cornerRadius={4}
                      fill="#ffffff"
                      stroke="#818cf8"
                      strokeWidth={1}
                      shadowColor="#94a3b8"
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
                      fontFamily="Inter, system-ui, sans-serif"
                      fill="#6366f1"
                      perfectDrawEnabled={false}
                    />
                  </Group>
                ) : null}
                <Circle
                  x={fromAnchor.x}
                  y={fromAnchor.y}
                  radius={isActive ? 3 : 2}
                  fill={isActive ? activeEdgeColor : tableBg}
                  stroke={stroke}
                  strokeWidth={isActive ? 1.5 : 1}
                  opacity={isActive ? 1 : 0.85}
                  listening={false}
                  perfectDrawEnabled={false}
                />
                <Circle
                  x={toAnchor.x}
                  y={toAnchor.y}
                  radius={isActive ? 3 : 2}
                  fill={isActive ? activeEdgeColor : tableBg}
                  stroke={stroke}
                  strokeWidth={isActive ? 1.5 : 1}
                  opacity={isActive ? 1 : 0.85}
                  listening={false}
                  perfectDrawEnabled={false}
                />
                <Text
                  x={fromAnchor.x + (effectiveFromSide === "right" ? 7 : -42)}
                  y={fromAnchor.y - 20}
                  width={36}
                  align={effectiveFromSide === "right" ? "left" : "right"}
                  text={rel.cardinalityLabelFrom ?? ""}
                  fontSize={11}
                  fontStyle={isActive ? "600" : "400"}
                  fontFamily="Inter, system-ui, sans-serif"
                  fill={stroke}
                  opacity={isActive ? 1 : 0.8}
                  listening={false}
                  perfectDrawEnabled={false}
                />
                <Text
                  x={toAnchor.x + (effectiveToSide === "right" ? 7 : -42)}
                  y={toAnchor.y - 20}
                  width={36}
                  align={effectiveToSide === "right" ? "left" : "right"}
                  text={rel.cardinalityLabelTo ?? ""}
                  fontSize={11}
                  fontStyle={isActive ? "600" : "400"}
                  fontFamily="Inter, system-ui, sans-serif"
                  fill={stroke}
                  opacity={isActive ? 1 : 0.8}
                  listening={false}
                  perfectDrawEnabled={false}
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
                    fontFamily="Inter, system-ui, sans-serif"
                    fill={activeEdgeColor}
                    listening={false}
                    perfectDrawEnabled={false}
                  />
                ) : null}
                {isSelected ? (
                  <Path
                    data={roundedPath}
                    stroke={activeEdgeColor}
                    strokeWidth={4.5}
                    lineCap="round"
                    lineJoin="round"
                    opacity={0.12}
                    perfectDrawEnabled={false}
                    listening={false}
                  />
                ) : null}
                <Path
                  data={roundedPath}
                  stroke="transparent"
                  strokeWidth={16}
                  lineCap="round"
                  lineJoin="round"
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
                        points: pointArrayToPairs(points),
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
                        points: pointArrayToPairs(points),
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
                  cornerRadius={6}
                  fill={tableBg}
                  stroke={isTableSelected ? selectedBorder : tableBorder}
                  strokeWidth={isTableSelected ? 1.5 : 1}
                  shadowColor={isDark ? "#000" : "#94a3b8"}
                  shadowBlur={isTableSelected ? 10 : 6}
                  shadowOpacity={isTableSelected ? 0.28 : isDark ? 0.4 : 0.15}
                  shadowOffsetY={2}
                  perfectDrawEnabled={false}
                />
                <Rect
                  width={DB_TABLE_WIDTH}
                  height={DB_HEADER_HEIGHT}
                  cornerRadius={[6, 6, 0, 0]}
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
                  fontFamily="Inter, system-ui, sans-serif"
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
                    fontFamily="Inter, system-ui, sans-serif"
                    fill="#dbeafe"
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
                        fontFamily="Inter, system-ui, sans-serif"
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
                        fontFamily="JetBrains Mono, ui-monospace, monospace"
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
                            cornerRadius={3}
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
                            fontFamily="Inter, system-ui, sans-serif"
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
          className={`pointer-events-none absolute inset-0 flex items-center justify-center text-sm ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          Escreva DBML no editor à esquerda para visualizar as tabelas.
        </div>
      ) : null}

      {activeEditor && activeEditorTable ? (
        <form
          onSubmit={handleSubmitEditor}
          className={`absolute z-50 rounded-lg border p-3 shadow-xl ${
            isDark
              ? "border-white/10 bg-slate-950 text-slate-100 shadow-black/40"
              : "border-slate-200 bg-white text-slate-900 shadow-slate-300/60"
          }`}
          style={{ left: editorLeft, top: editorTop, width: EDITOR_WIDTH }}
        >
          <label
            htmlFor="database-editor-name"
            className="mb-2 block text-[11px] font-semibold text-slate-500"
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
            className={`w-full rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-400 ${
              isDark
                ? "border-slate-700 bg-slate-900 text-slate-100"
                : "border-slate-300 bg-white text-slate-900"
            }`}
          />
          {activeEditor.error ? (
            <p className="mt-2 text-xs text-rose-500">{activeEditor.error}</p>
          ) : null}
          <div className="mt-3 flex items-center justify-between gap-2">
            {activeEditor.type === "table" &&
            activeEditorTable.records &&
            activeEditorTable.records.rows.length > 0 ? (
              <button
                type="button"
                onClick={() => setRecordsTableId(activeEditorTable.id)}
                className={`rounded-md px-2 py-1 text-xs font-medium ${
                  isDark
                    ? "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
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
                className={`rounded-md px-2 py-1 text-xs ${
                  isDark
                    ? "text-slate-300 hover:bg-white/10"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-500"
              >
                Salvar
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {recordsTable?.records ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="database-records-title"
            className={`max-h-full w-full max-w-4xl overflow-hidden rounded-xl border shadow-2xl ${
              isDark
                ? "border-white/10 bg-slate-950 text-slate-100"
                : "border-slate-200 bg-white text-slate-900"
            }`}
          >
            <div
              className={`flex items-center justify-between border-b px-4 py-3 ${
                isDark ? "border-white/10" : "border-slate-200"
              }`}
            >
              <h2 id="database-records-title" className="text-sm font-semibold">
                Records de {recordsTable.name}
              </h2>
              <button
                type="button"
                onClick={() => setRecordsTableId(null)}
                className={`rounded-md px-2 py-1 text-sm ${
                  isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
                }`}
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
                        className={`border px-3 py-2 font-semibold ${
                          isDark
                            ? "border-slate-800 bg-slate-900"
                            : "border-slate-200 bg-slate-50"
                        }`}
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
                          className={`border px-3 py-2 ${
                            isDark ? "border-slate-800" : "border-slate-200"
                          }`}
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

      <div
        className={`absolute bottom-4 left-4 z-40 flex items-center overflow-hidden rounded-lg border shadow-lg ${
          isDark
            ? "border-white/10 bg-ink/85 text-slate-100 shadow-black/30"
            : "border-slate-200 bg-white/95 text-slate-800 shadow-slate-300/40"
        }`}
      >
        <button
          type="button"
          onClick={() => handleZoom(-1)}
          disabled={viewportScale <= MIN_SCALE}
          className={`flex h-9 w-9 items-center justify-center text-base font-semibold transition ${
            isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
          } disabled:cursor-not-allowed disabled:opacity-40`}
          aria-label="Diminuir zoom"
          title="Diminuir zoom"
        >
          -
        </button>
        <div
          className={`border-x px-3 py-2 text-[11px] font-semibold tabular-nums ${
            isDark ? "border-white/10" : "border-slate-200"
          }`}
        >
          {Math.round(viewportScale * 100)}%
        </div>
        <button
          type="button"
          onClick={() => handleZoom(1)}
          disabled={viewportScale >= MAX_SCALE}
          className={`flex h-9 w-9 items-center justify-center text-base font-semibold transition ${
            isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
          } disabled:cursor-not-allowed disabled:opacity-40`}
          aria-label="Aumentar zoom"
          title="Aumentar zoom"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleFitToContent}
          className={`border-l px-3 py-2 text-xs font-semibold transition ${
            isDark
              ? "border-white/10 hover:bg-white/10"
              : "border-slate-200 hover:bg-slate-100"
          }`}
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
          className={`border-l px-3 py-2 text-xs font-semibold transition ${
            interactionMode === "pan"
              ? "bg-blue-600 text-white"
              : isDark
                ? "border-white/10 hover:bg-white/10"
                : "border-slate-200 hover:bg-slate-100"
          }`}
        >
          {interactionMode === "pan" ? "Pan" : "Selecionar"}
        </button>
      </div>
    </div>
  );
}
