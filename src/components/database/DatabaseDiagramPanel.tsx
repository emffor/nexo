"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import Konva from "konva";

import type { AppTheme } from "../../lib/preferences";
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
  DatabaseTable,
  DatabaseTablePosition,
} from "../../types/database";

interface DatabaseDiagramPanelProps {
  tables: DatabaseTable[];
  relations: DatabaseRelation[];
  theme: AppTheme;
  state: DatabaseDiagramVisualState;
  onStateChange: (state: DatabaseDiagramVisualState) => void;
  resetSignal?: number;
}

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.8;
const SCALE_STEP = 1.05;
const INITIAL_VIEWPORT: DatabaseDiagramViewport = { x: 0, y: 0, scale: 1 };

Konva.pixelRatio = 1;

function columnYCenter(columnIndex: number): number {
  return DB_HEADER_HEIGHT + columnIndex * DB_ROW_HEIGHT + DB_ROW_HEIGHT / 2;
}

function getColumnAnchor(
  position: DatabaseTablePosition,
  columnIndex: number,
  side: "left" | "right",
): { x: number; y: number } {
  return {
    x: side === "left" ? position.x : position.x + DB_TABLE_WIDTH,
    y: position.y + columnYCenter(columnIndex),
  };
}

function buildOrthogonalPath(
  from: { x: number; y: number },
  fromSide: "left" | "right",
  to: { x: number; y: number },
  toSide: "left" | "right",
): number[] {
  const handle = 28;
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

export default function DatabaseDiagramPanel({
  tables,
  relations,
  theme,
  state,
  onStateChange,
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
      const current = stateRef.current;
      onStateChange({
        ...current,
        positions: { ...current.positions, [id]: { x, y } },
      });
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

  const isDark = theme === "dark";
  const stageBg = isDark ? "#0b0f17" : "#f8fafc";
  const tableBg = isDark ? "#0f172a" : "#ffffff";
  const tableBorder = isDark ? "#1e293b" : "#cbd5e1";
  const headerBg = isDark ? "#1e3a8a" : "#3b82f6";
  const headerText = "#ffffff";
  const rowText = isDark ? "#e2e8f0" : "#0f172a";
  const typeText = isDark ? "#94a3b8" : "#64748b";
  const edgeColor = isDark ? "#94a3b8" : "#64748b";
  const badgeBg = isDark ? "#1e293b" : "#e2e8f0";
  const badgeText = isDark ? "#cbd5e1" : "#475569";

  const tableLookup = useMemo(() => {
    const map = new Map<string, DatabaseTable>();
    tables.forEach((t) => map.set(t.id, t));
    return map;
  }, [tables]);

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
        draggable
        onDragEnd={handleStageDragEnd}
        onWheel={handleWheel}
      >
        <Layer listening={false}>
          {relations.map((rel) => {
            const fromTable = tableLookup.get(rel.fromTable);
            const toTable = tableLookup.get(rel.toTable);
            if (!fromTable || !toTable) {
              return null;
            }
            const fromPos = state.positions[fromTable.id];
            const toPos = state.positions[toTable.id];
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
            const fromCenter = fromPos.x + DB_TABLE_WIDTH / 2;
            const toCenter = toPos.x + DB_TABLE_WIDTH / 2;
            const fromSide: "left" | "right" =
              toCenter >= fromCenter ? "right" : "left";
            const toSide: "left" | "right" =
              fromCenter >= toCenter ? "right" : "left";
            const fromAnchor = getColumnAnchor(fromPos, fromColIndex, fromSide);
            const toAnchor = getColumnAnchor(toPos, toColIndex, toSide);
            const points = buildOrthogonalPath(
              fromAnchor,
              fromSide,
              toAnchor,
              toSide,
            );
            return (
              <Line
                key={rel.id}
                points={points}
                stroke={edgeColor}
                strokeWidth={1.5}
                lineCap="round"
                lineJoin="round"
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
              />
            );
          })}
        </Layer>

        <Layer>
          {tables.map((table) => {
            const pos = state.positions[table.id];
            if (!pos) {
              return null;
            }
            const height = computeDatabaseTableHeight(table.columns.length);
            return (
              <Group
                key={table.id}
                x={pos.x}
                y={pos.y}
                draggable
                onDragEnd={(event) => handleTableDragEnd(table.id, event)}
                onMouseEnter={(event) => {
                  const stage = event.target.getStage();
                  if (stage) {
                    stage.container().style.cursor = "grab";
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
                  width={DB_TABLE_WIDTH}
                  height={height}
                  cornerRadius={6}
                  fill={tableBg}
                  stroke={tableBorder}
                  strokeWidth={1}
                  shadowColor={isDark ? "#000" : "#94a3b8"}
                  shadowBlur={6}
                  shadowOpacity={isDark ? 0.4 : 0.15}
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
                  width={DB_TABLE_WIDTH - 24}
                  text={table.name}
                  fontSize={13}
                  fontStyle="600"
                  fontFamily="Inter, system-ui, sans-serif"
                  fill={headerText}
                  ellipsis
                  listening={false}
                  perfectDrawEnabled={false}
                />
                {table.columns.map((column, colIdx) => {
                  const y = DB_HEADER_HEIGHT + colIdx * DB_ROW_HEIGHT;
                  const isLastRow = colIdx === table.columns.length - 1;
                  const flagsX = DB_TABLE_WIDTH - 12;
                  return (
                    <Group key={column.id} y={y} listening={false}>
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
                        perfectDrawEnabled={false}
                      />
                      <Text
                        x={DB_TABLE_WIDTH / 2}
                        y={(DB_ROW_HEIGHT - 12) / 2}
                        width={
                          DB_TABLE_WIDTH / 2 -
                          16 -
                          (column.isPrimaryKey && column.isNotNull
                            ? 52
                            : column.isPrimaryKey || column.isNotNull
                              ? 26
                              : 0)
                        }
                        align="right"
                        text={column.type}
                        fontSize={11}
                        fontFamily="JetBrains Mono, ui-monospace, monospace"
                        fill={typeText}
                        ellipsis
                        perfectDrawEnabled={false}
                      />
                      {column.isPrimaryKey && (
                        <Group
                          x={flagsX - (column.isNotNull ? 50 : 22)}
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
                            text="PK"
                            fontSize={9}
                            fontStyle="700"
                            fontFamily="Inter, system-ui, sans-serif"
                            fill={badgeText}
                            perfectDrawEnabled={false}
                          />
                        </Group>
                      )}
                      {column.isNotNull && (
                        <Group x={flagsX - 22} y={(DB_ROW_HEIGHT - 14) / 2}>
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
                            text="NN"
                            fontSize={9}
                            fontStyle="700"
                            fontFamily="Inter, system-ui, sans-serif"
                            fill={badgeText}
                            perfectDrawEnabled={false}
                          />
                        </Group>
                      )}
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

      <div
        className={`absolute bottom-4 right-4 z-40 flex flex-col items-center overflow-hidden rounded-lg border shadow-lg ${
          isDark
            ? "border-white/10 bg-ink/85 text-slate-100 shadow-black/30"
            : "border-slate-200 bg-white/95 text-slate-800 shadow-slate-300/40"
        }`}
      >
        <button
          type="button"
          onClick={() => handleZoom(1)}
          disabled={viewportScale >= MAX_SCALE}
          className={`flex h-8 w-8 items-center justify-center text-base font-semibold transition ${
            isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
          } disabled:cursor-not-allowed disabled:opacity-40`}
          aria-label="Aumentar zoom"
          title="Aumentar zoom"
        >
          +
        </button>
        <div
          className={`border-y px-2 py-1 text-[10px] font-semibold tabular-nums ${
            isDark ? "border-white/10" : "border-slate-200"
          }`}
        >
          {Math.round(viewportScale * 100)}%
        </div>
        <button
          type="button"
          onClick={() => handleZoom(-1)}
          disabled={viewportScale <= MIN_SCALE}
          className={`flex h-8 w-8 items-center justify-center text-base font-semibold transition ${
            isDark ? "hover:bg-white/10" : "hover:bg-slate-100"
          } disabled:cursor-not-allowed disabled:opacity-40`}
          aria-label="Diminuir zoom"
          title="Diminuir zoom"
        >
          -
        </button>
      </div>
    </div>
  );
}
