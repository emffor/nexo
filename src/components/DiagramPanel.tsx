"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Arrow, Circle, Group, Layer, Rect, Stage, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type Konva from "konva";

import { getDisplayTitle } from "../lib/items";
import {
  DIAGRAM_GRID_OFFSET,
  DIAGRAM_NODE_HEIGHT,
  DIAGRAM_NODE_WIDTH,
  computeAutoLayout,
  snapToGrid,
} from "../lib/diagramLayout";
import { readDiagramState, writeDiagramState } from "../lib/diagramState";
import type { AppTheme } from "../lib/preferences";
import { DIAGRAM_STATUS_PALETTE } from "../types/diagram";
import type { DiagramEdge, DiagramNodePosition } from "../types/diagram";
import type { DiagramStatus, MarkdownItem } from "../types/markdown";
import { DiagramLegend } from "./DiagramLegend";

interface DiagramPanelProps {
  items: MarkdownItem[];
  theme: AppTheme;
  activeItemId: string | null;
  onSelectItem: (item: MarkdownItem) => void;
  onChangeStatus: (itemId: string, status: DiagramStatus | undefined) => void;
  scrollContainerRef?: RefObject<HTMLDivElement>;
  resetLayoutSignal?: number;
  clearEdgesSignal?: number;
}

interface PendingConnection {
  fromId: string;
  pointerX: number;
  pointerY: number;
}

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.8;
const SCALE_STEP = 1.05;

function getNodeCenters(position: DiagramNodePosition): {
  right: { x: number; y: number };
  left: { x: number; y: number };
  centerY: number;
} {
  return {
    right: {
      x: position.x + DIAGRAM_NODE_WIDTH,
      y: position.y + DIAGRAM_NODE_HEIGHT / 2,
    },
    left: {
      x: position.x,
      y: position.y + DIAGRAM_NODE_HEIGHT / 2,
    },
    centerY: position.y + DIAGRAM_NODE_HEIGHT / 2,
  };
}

export default function DiagramPanel({
  items,
  theme,
  activeItemId,
  onSelectItem,
  onChangeStatus: _onChangeStatus,
  scrollContainerRef,
  resetLayoutSignal = 0,
  clearEdgesSignal = 0,
}: DiagramPanelProps) {
  void _onChangeStatus;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });
  const [positions, setPositions] = useState<
    Record<string, DiagramNodePosition>
  >({});
  const [edges, setEdges] = useState<DiagramEdge[]>([]);
  const [stagePos, setStagePos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [stageScale, setStageScale] = useState(1);
  const [pending, setPending] = useState<PendingConnection | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

  // hidratar estado salvo
  useEffect(() => {
    const stored = readDiagramState();
    setPositions(stored.positions);
    setEdges(stored.edges);
  }, []);

  // garantir posicao para todo item
  useEffect(() => {
    setPositions((current) => {
      const missing = items.filter((item) => !current[item.id]);
      if (missing.length === 0) {
        return current;
      }
      const startIndex = Object.keys(current).length;
      const next = { ...current };
      missing.forEach((item, idx) => {
        const totalIndex = startIndex + idx;
        const col = totalIndex % 4;
        const row = Math.floor(totalIndex / 4);
        next[item.id] = {
          x: DIAGRAM_GRID_OFFSET + col * (DIAGRAM_NODE_WIDTH + 80),
          y: DIAGRAM_GRID_OFFSET + row * (DIAGRAM_NODE_HEIGHT + 40),
        };
      });
      return next;
    });
  }, [items]);

  // limpar edges/posicoes orfãs quando items mudam
  useEffect(() => {
    const validIds = new Set(items.map((item) => item.id));
    setEdges((current) =>
      current.filter(
        (edge) => validIds.has(edge.from) && validIds.has(edge.to),
      ),
    );
  }, [items]);

  // persistir
  useEffect(() => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      writeDiagramState({ positions, edges });
    }, 250);
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [positions, edges]);

  // resetLayout quando o sinal mudar
  useEffect(() => {
    if (resetLayoutSignal === 0) {
      return;
    }
    setPositions(
      computeAutoLayout(
        items.map((i) => i.id),
        4,
      ),
    );
    setStagePos({ x: 0, y: 0 });
    setStageScale(1);
  }, [resetLayoutSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (clearEdgesSignal === 0) {
      return;
    }
    setEdges([]);
  }, [clearEdgesSignal]);

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

  const handleNodeDragMove = useCallback(
    (id: string, event: KonvaEventObject<DragEvent>) => {
      const node = event.target;
      setPositions((current) => ({
        ...current,
        [id]: { x: node.x(), y: node.y() },
      }));
    },
    [],
  );

  const handleNodeDragEnd = useCallback(
    (id: string, event: KonvaEventObject<DragEvent>) => {
      const node = event.target;
      const x = snapToGrid(node.x());
      const y = snapToGrid(node.y());
      node.position({ x, y });
      setPositions((current) => ({
        ...current,
        [id]: { x, y },
      }));
    },
    [],
  );

  const stageToWorld = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) {
      return { x: 0, y: 0 };
    }
    const transform = stage.getAbsoluteTransform().copy().invert();
    return transform.point({ x: clientX, y: clientY });
  }, []);

  const findNodeAtPoint = useCallback(
    (worldX: number, worldY: number): MarkdownItem | null => {
      for (const item of items) {
        const pos = positions[item.id];
        if (!pos) {
          continue;
        }
        if (
          worldX >= pos.x &&
          worldX <= pos.x + DIAGRAM_NODE_WIDTH &&
          worldY >= pos.y &&
          worldY <= pos.y + DIAGRAM_NODE_HEIGHT
        ) {
          return item;
        }
      }
      return null;
    },
    [items, positions],
  );

  const handlePortMouseDown = useCallback(
    (fromId: string, event: KonvaEventObject<MouseEvent>) => {
      event.cancelBubble = true;
      const stage = stageRef.current;
      if (!stage) {
        return;
      }
      const pointer = stage.getPointerPosition();
      if (!pointer) {
        return;
      }
      const world = stageToWorld(pointer.x, pointer.y);
      setPending({ fromId, pointerX: world.x, pointerY: world.y });
    },
    [stageToWorld],
  );

  const handleStageMouseMove = useCallback(() => {
    if (!pending) {
      return;
    }
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    const pointer = stage.getPointerPosition();
    if (!pointer) {
      return;
    }
    const world = stageToWorld(pointer.x, pointer.y);
    setPending((current) =>
      current ? { ...current, pointerX: world.x, pointerY: world.y } : null,
    );
  }, [pending, stageToWorld]);

  const handleStageMouseUp = useCallback(() => {
    if (!pending) {
      return;
    }
    const targetItem = findNodeAtPoint(pending.pointerX, pending.pointerY);
    if (targetItem && targetItem.id !== pending.fromId) {
      setEdges((current) => {
        const exists = current.some(
          (edge) => edge.from === pending.fromId && edge.to === targetItem.id,
        );
        if (exists) {
          return current;
        }
        return [
          ...current,
          {
            id: `${pending.fromId}-${targetItem.id}-${Date.now()}`,
            from: pending.fromId,
            to: targetItem.id,
          },
        ];
      });
    }
    setPending(null);
  }, [pending, findNodeAtPoint]);

  const handleWheel = useCallback((event: KonvaEventObject<WheelEvent>) => {
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
    setStageScale(newScale);
    setStagePos(newPos);
  }, []);

  const handleEdgeClick = useCallback((edgeId: string) => {
    setEdges((current) => current.filter((edge) => edge.id !== edgeId));
  }, []);

  const isDark = theme === "dark";
  const stageBg = isDark ? "#0b0f17" : "#f8fafc";
  const edgeColor = isDark ? "#94a3b8" : "#475569";
  const edgeHoverColor = isDark ? "#f87171" : "#dc2626";
  const portColor = isDark ? "#5eead4" : "#0d9488";

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        if (scrollContainerRef) {
          (scrollContainerRef as { current: HTMLDivElement | null }).current =
            el;
        }
      }}
      className={`relative h-full min-h-[480px] w-full overflow-hidden rounded-[1.25rem] border ${
        isDark ? "border-white/10 bg-ink/60" : "border-slate-200 bg-white"
      }`}
      style={{ backgroundColor: stageBg }}
    >
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        x={stagePos.x}
        y={stagePos.y}
        scaleX={stageScale}
        scaleY={stageScale}
        draggable={!pending}
        onDragEnd={(event) => {
          if (event.target === event.target.getStage()) {
            setStagePos({ x: event.target.x(), y: event.target.y() });
          }
        }}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onWheel={handleWheel}
      >
        <Layer listening={false}>{/* fundo decorativo (grid sutil) */}</Layer>

        <Layer>
          {edges.map((edge) => {
            const fromPos = positions[edge.from];
            const toPos = positions[edge.to];
            if (!fromPos || !toPos) {
              return null;
            }
            const from = getNodeCenters(fromPos).right;
            const to = getNodeCenters(toPos).left;
            const midX = (from.x + to.x) / 2;
            const points = [
              from.x,
              from.y,
              midX,
              from.y,
              midX,
              to.y,
              to.x,
              to.y,
            ];
            const isHover = hoveredEdgeId === edge.id;
            return (
              <Arrow
                key={edge.id}
                points={points}
                stroke={isHover ? edgeHoverColor : edgeColor}
                strokeWidth={isHover ? 2.5 : 1.8}
                fill={isHover ? edgeHoverColor : edgeColor}
                pointerLength={8}
                pointerWidth={8}
                hitStrokeWidth={14}
                onMouseEnter={(event) => {
                  setHoveredEdgeId(edge.id);
                  const stage = event.target.getStage();
                  if (stage) {
                    stage.container().style.cursor = "pointer";
                  }
                }}
                onMouseLeave={(event) => {
                  setHoveredEdgeId((current) =>
                    current === edge.id ? null : current,
                  );
                  const stage = event.target.getStage();
                  if (stage) {
                    stage.container().style.cursor = "default";
                  }
                }}
                onClick={() => handleEdgeClick(edge.id)}
                onTap={() => handleEdgeClick(edge.id)}
              />
            );
          })}

          {pending
            ? (() => {
                const fromPos = positions[pending.fromId];
                if (!fromPos) {
                  return null;
                }
                const from = getNodeCenters(fromPos).right;
                return (
                  <Arrow
                    points={[
                      from.x,
                      from.y,
                      pending.pointerX,
                      pending.pointerY,
                    ]}
                    stroke={portColor}
                    strokeWidth={2}
                    fill={portColor}
                    dash={[6, 4]}
                    pointerLength={8}
                    pointerWidth={8}
                    listening={false}
                  />
                );
              })()
            : null}
        </Layer>

        <Layer>
          {items.map((item) => {
            const pos = positions[item.id];
            if (!pos) {
              return null;
            }
            const status = item.status ?? "backlog";
            const palette = DIAGRAM_STATUS_PALETTE[status][theme];
            const isActive = item.id === activeItemId;
            const title = getDisplayTitle(item, 70);
            return (
              <Group
                key={item.id}
                x={pos.x}
                y={pos.y}
                draggable
                onDragMove={(event) => handleNodeDragMove(item.id, event)}
                onDragEnd={(event) => handleNodeDragEnd(item.id, event)}
                onClick={() => onSelectItem(item)}
                onTap={() => onSelectItem(item)}
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
                  width={DIAGRAM_NODE_WIDTH}
                  height={DIAGRAM_NODE_HEIGHT}
                  cornerRadius={12}
                  fill={palette.fill}
                  stroke={isActive ? "#2dd4bf" : palette.border}
                  strokeWidth={isActive ? 2.4 : 1.4}
                  shadowColor={isDark ? "#000" : "#94a3b8"}
                  shadowBlur={isActive ? 12 : 6}
                  shadowOpacity={isDark ? 0.45 : 0.25}
                  shadowOffsetY={2}
                />
                <Text
                  x={12}
                  y={12}
                  width={DIAGRAM_NODE_WIDTH - 24}
                  height={DIAGRAM_NODE_HEIGHT - 24}
                  text={title}
                  fontSize={13}
                  fontStyle="600"
                  fontFamily="Inter, system-ui, sans-serif"
                  fill={palette.text}
                  lineHeight={1.25}
                  ellipsis
                  wrap="word"
                />
                {/* port direita: pressione e arraste para conectar */}
                <Circle
                  x={DIAGRAM_NODE_WIDTH}
                  y={DIAGRAM_NODE_HEIGHT / 2}
                  radius={6}
                  fill={portColor}
                  stroke={isDark ? "#0b0f17" : "#ffffff"}
                  strokeWidth={2}
                  onMouseDown={(event) => handlePortMouseDown(item.id, event)}
                  onTouchStart={(event) => {
                    event.cancelBubble = true;
                    const stage = stageRef.current;
                    if (!stage) {
                      return;
                    }
                    const pointer = stage.getPointerPosition();
                    if (!pointer) {
                      return;
                    }
                    const world = stageToWorld(pointer.x, pointer.y);
                    setPending({
                      fromId: item.id,
                      pointerX: world.x,
                      pointerY: world.y,
                    });
                  }}
                  onMouseEnter={(event) => {
                    const stage = event.target.getStage();
                    if (stage) {
                      stage.container().style.cursor = "crosshair";
                    }
                  }}
                />
              </Group>
            );
          })}
        </Layer>
      </Stage>

      <DiagramLegend theme={theme} />

      {items.length === 0 ? (
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center text-sm ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          Adicione cards para visualizar o diagrama.
        </div>
      ) : null}

      <div
        className={`pointer-events-none absolute right-3 top-3 rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
          isDark
            ? "border-white/10 bg-ink/70 text-slate-300"
            : "border-slate-200 bg-white/90 text-slate-600"
        }`}
      >
        Arraste cards · porta verde para ligar · clique na seta para remover
      </div>
    </div>
  );
}
