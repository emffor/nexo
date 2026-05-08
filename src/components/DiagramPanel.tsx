"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Arrow, Circle, Group, Layer, Rect, Stage, Text } from "react-konva";
import type { KonvaEventObject } from "konva/lib/Node";
import Konva from "konva";

import { getDisplayTitle } from "../lib/items";
import {
  DIAGRAM_GRID_OFFSET,
  DIAGRAM_NODE_HEIGHT,
  DIAGRAM_NODE_WIDTH,
  computeAutoLayout,
  snapToGrid,
} from "../lib/diagramLayout";
import { readDiagramState, writeDiagramState } from "../lib/diagramState";
import type { AppTheme, DiagramEdgeStyle } from "../lib/preferences";
import { DIAGRAM_STATUS_PALETTE } from "../types/diagram";
import type {
  DiagramEdge,
  DiagramNodePosition,
  DiagramPortSide,
  DiagramState,
  DiagramViewport,
} from "../types/diagram";
import type { DiagramStatus, MarkdownItem } from "../types/markdown";
import { DiagramLegend } from "./DiagramLegend";

interface DiagramPanelProps {
  items: MarkdownItem[];
  theme: AppTheme;
  activeItemId: string | null;
  hiddenItemIds?: Set<string>;
  edgeStyle?: DiagramEdgeStyle;
  onSelectItem: (item: MarkdownItem) => void;
  onChangeStatus: (itemId: string, status: DiagramStatus | undefined) => void;
  scrollContainerRef?: RefObject<HTMLDivElement>;
  resetLayoutSignal?: number;
  clearEdgesSignal?: number;
  reloadStateSignal?: number;
  onDiagramStateChange?: (state: DiagramState) => void;
}

interface PendingConnection {
  fromId: string;
  fromPort: DiagramPortSide;
  pointerX: number;
  pointerY: number;
}

interface DiagramPort {
  item: MarkdownItem;
  side: DiagramPortSide;
}

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.8;
const SCALE_STEP = 1.05;
const PORT_RADIUS = 6;
const PORT_HOVER_RADIUS = 10;
const PORT_HIT_RADIUS = 22;
const EDGE_STROKE_WIDTH = 2.4;
const EDGE_HOVER_STROKE_WIDTH = 3.2;
const EDGE_POINTER_SIZE = 12;
const EDGE_HIT_STROKE_WIDTH = 18;
const INITIAL_STAGE_TRANSFORM: DiagramViewport = { x: 0, y: 0, scale: 1 };
const DIAGRAM_PORT_SIDES: DiagramPortSide[] = [
  "top",
  "right",
  "bottom",
  "left",
];

const PORT_DIRECTIONS: Record<DiagramPortSide, { x: number; y: number }> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

Konva.pixelRatio = 1;

function getPortPosition(
  position: DiagramNodePosition,
  side: DiagramPortSide,
): { x: number; y: number } {
  if (side === "top") {
    return { x: position.x + DIAGRAM_NODE_WIDTH / 2, y: position.y };
  }
  if (side === "right") {
    return {
      x: position.x + DIAGRAM_NODE_WIDTH,
      y: position.y + DIAGRAM_NODE_HEIGHT / 2,
    };
  }
  if (side === "bottom") {
    return {
      x: position.x + DIAGRAM_NODE_WIDTH / 2,
      y: position.y + DIAGRAM_NODE_HEIGHT,
    };
  }
  return { x: position.x, y: position.y + DIAGRAM_NODE_HEIGHT / 2 };
}

function getCurveEdgePoints(
  fromPosition: DiagramNodePosition,
  fromPort: DiagramPortSide,
  toPosition: DiagramNodePosition,
  toPort: DiagramPortSide,
): number[] {
  const from = getPortPosition(fromPosition, fromPort);
  const to = getPortPosition(toPosition, toPort);
  const fromDirection = PORT_DIRECTIONS[fromPort];
  const toDirection = PORT_DIRECTIONS[toPort];
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const controlOffset = Math.max(72, Math.min(180, distance * 0.45));
  const fromControl = {
    x: from.x + fromDirection.x * controlOffset,
    y: from.y + fromDirection.y * controlOffset,
  };
  const toControl = {
    x: to.x + toDirection.x * controlOffset,
    y: to.y + toDirection.y * controlOffset,
  };

  return [
    from.x,
    from.y,
    fromControl.x,
    fromControl.y,
    toControl.x,
    toControl.y,
    to.x,
    to.y,
  ];
}

function getSquareEdgePoints(
  fromPosition: DiagramNodePosition,
  fromPort: DiagramPortSide,
  toPosition: DiagramNodePosition,
  toPort: DiagramPortSide,
): number[] {
  const from = getPortPosition(fromPosition, fromPort);
  const to = getPortPosition(toPosition, toPort);
  const fromDirection = PORT_DIRECTIONS[fromPort];
  const toDirection = PORT_DIRECTIONS[toPort];
  const offset = 36;
  const fromHandle = {
    x: from.x + fromDirection.x * offset,
    y: from.y + fromDirection.y * offset,
  };
  const toHandle = {
    x: to.x + toDirection.x * offset,
    y: to.y + toDirection.y * offset,
  };
  const fromIsVertical = fromDirection.y !== 0;
  const toIsVertical = toDirection.y !== 0;

  if (fromIsVertical && toIsVertical) {
    const trackY = (fromHandle.y + toHandle.y) / 2;
    return [
      from.x,
      from.y,
      fromHandle.x,
      fromHandle.y,
      fromHandle.x,
      trackY,
      toHandle.x,
      trackY,
      toHandle.x,
      toHandle.y,
      to.x,
      to.y,
    ];
  }

  if (!fromIsVertical && !toIsVertical) {
    const trackX = (fromHandle.x + toHandle.x) / 2;
    return [
      from.x,
      from.y,
      fromHandle.x,
      fromHandle.y,
      trackX,
      fromHandle.y,
      trackX,
      toHandle.y,
      toHandle.x,
      toHandle.y,
      to.x,
      to.y,
    ];
  }

  const corner = fromIsVertical
    ? { x: fromHandle.x, y: toHandle.y }
    : { x: toHandle.x, y: fromHandle.y };

  return [
    from.x,
    from.y,
    fromHandle.x,
    fromHandle.y,
    corner.x,
    corner.y,
    toHandle.x,
    toHandle.y,
    to.x,
    to.y,
  ];
}

export default function DiagramPanel({
  items,
  theme,
  activeItemId,
  hiddenItemIds,
  edgeStyle = "curve",
  onSelectItem,
  onChangeStatus: _onChangeStatus,
  scrollContainerRef,
  resetLayoutSignal = 0,
  clearEdgesSignal = 0,
  reloadStateSignal = 0,
  onDiagramStateChange,
}: DiagramPanelProps) {
  void _onChangeStatus;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const nodesLayerRef = useRef<Konva.Layer | null>(null);
  const dragLayerRef = useRef<Konva.Layer | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewportPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastResetLayoutSignalRef = useRef(resetLayoutSignal);
  const stageTransformRef = useRef<DiagramViewport>(INITIAL_STAGE_TRANSFORM);
  const positionsRef = useRef<Record<string, DiagramNodePosition>>({});
  const edgesRef = useRef<DiagramEdge[]>([]);

  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 800,
    height: 600,
  });
  const [positions, setPositions] = useState<
    Record<string, DiagramNodePosition>
  >({});
  const [edges, setEdges] = useState<DiagramEdge[]>([]);
  const [pending, setPending] = useState<PendingConnection | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [hoveredPortId, setHoveredPortId] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<{
    item: MarkdownItem;
    x: number;
    y: number;
  } | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const visibleItems = useMemo(
    () => items.filter((item) => !hiddenItemIds?.has(item.id)),
    [hiddenItemIds, items],
  );
  const visibleItemIds = useMemo(
    () => new Set(visibleItems.map((item) => item.id)),
    [visibleItems],
  );
  const visibleEdges = useMemo(
    () =>
      edges.filter(
        (edge) => visibleItemIds.has(edge.from) && visibleItemIds.has(edge.to),
      ),
    [edges, visibleItemIds],
  );

  const emitDiagramState = useCallback(
    (state: DiagramState) => {
      writeDiagramState(state);
      onDiagramStateChange?.(state);
    },
    [onDiagramStateChange],
  );

  const applyStageTransform = useCallback((transform: DiagramViewport) => {
    stageTransformRef.current = transform;
    const stage = stageRef.current;
    if (!stage) {
      return;
    }
    stage.position({ x: transform.x, y: transform.y });
    stage.scale({ x: transform.scale, y: transform.scale });
    stage.batchDraw();
  }, []);

  const scheduleViewportPersist = useCallback(() => {
    if (viewportPersistTimerRef.current) {
      clearTimeout(viewportPersistTimerRef.current);
    }
    viewportPersistTimerRef.current = setTimeout(() => {
      emitDiagramState({
        positions: positionsRef.current,
        edges: edgesRef.current,
        viewport: stageTransformRef.current,
      });
    }, 250);
  }, [emitDiagramState]);

  const loadStoredDiagramState = useCallback(() => {
    const stored = readDiagramState();
    positionsRef.current = stored.positions;
    edgesRef.current = stored.edges;
    setPositions(stored.positions);
    setEdges(stored.edges);
    applyStageTransform(stored.viewport ?? INITIAL_STAGE_TRANSFORM);
    onDiagramStateChange?.(stored);
    setIsHydrated(true);
  }, [applyStageTransform, onDiagramStateChange]);

  // hidratar estado salvo
  useEffect(() => {
    loadStoredDiagramState();
  }, [loadStoredDiagramState]);

  useEffect(() => {
    if (reloadStateSignal === 0) {
      return;
    }
    loadStoredDiagramState();
  }, [reloadStateSignal, loadStoredDiagramState]);

  const persistCurrentDiagramState = useCallback(() => {
    emitDiagramState({
      positions: positionsRef.current,
      edges: edgesRef.current,
      viewport: stageTransformRef.current,
    });
  }, [emitDiagramState]);

  const setDiagramEdges = useCallback(
    (nextEdges: DiagramEdge[]) => {
      edgesRef.current = nextEdges;
      setEdges(nextEdges);
      emitDiagramState({
        positions: positionsRef.current,
        edges: nextEdges,
        viewport: stageTransformRef.current,
      });
    },
    [emitDiagramState],
  );

  const setDiagramPositions = useCallback(
    (nextPositions: Record<string, DiagramNodePosition>) => {
      positionsRef.current = nextPositions;
      setPositions(nextPositions);
      emitDiagramState({
        positions: nextPositions,
        edges: edgesRef.current,
        viewport: stageTransformRef.current,
      });
    },
    [emitDiagramState],
  );

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    onDiagramStateChange?.({
      positions,
      edges,
      viewport: stageTransformRef.current,
    });
  }, [edges, isHydrated, onDiagramStateChange, positions]);

  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // garantir posicao para todo item
  useEffect(() => {
    if (!isHydrated) {
      return;
    }
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
  }, [items, isHydrated]);

  // limpar edges/posicoes orfãs quando items mudam
  useEffect(() => {
    const validIds = new Set(items.map((item) => item.id));
    setEdges((current) => {
      const next = current.filter(
        (edge) => validIds.has(edge.from) && validIds.has(edge.to),
      );
      if (next.length === current.length) {
        return current;
      }
      edgesRef.current = next;
      emitDiagramState({
        positions: positionsRef.current,
        edges: next,
        viewport: stageTransformRef.current,
      });
      return next;
    });
  }, [emitDiagramState, items]);

  // persistir
  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = setTimeout(() => {
      emitDiagramState({
        positions,
        edges,
        viewport: stageTransformRef.current,
      });
    }, 250);
    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [positions, edges, emitDiagramState, isHydrated]);

  useEffect(() => {
    return () => {
      if (viewportPersistTimerRef.current) {
        clearTimeout(viewportPersistTimerRef.current);
      }
    };
  }, []);

  // resetLayout quando o sinal mudar
  useEffect(() => {
    if (
      resetLayoutSignal === 0 ||
      resetLayoutSignal === lastResetLayoutSignalRef.current
    ) {
      return;
    }
    lastResetLayoutSignalRef.current = resetLayoutSignal;
    const nextPositions = computeAutoLayout(
      items.map((i) => i.id),
      4,
    );
    setDiagramPositions(nextPositions);
    applyStageTransform(INITIAL_STAGE_TRANSFORM);
    emitDiagramState({
      positions: nextPositions,
      edges: edgesRef.current,
      viewport: INITIAL_STAGE_TRANSFORM,
    });
  }, [
    applyStageTransform,
    emitDiagramState,
    items,
    resetLayoutSignal,
    setDiagramPositions,
  ]);

  useEffect(() => {
    if (clearEdgesSignal === 0) {
      return;
    }
    setDiagramEdges([]);
  }, [clearEdgesSignal, setDiagramEdges]);

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

  const handleNodeDragEnd = useCallback(
    (id: string, event: KonvaEventObject<DragEvent>) => {
      const node = event.target;
      const x = snapToGrid(node.x());
      const y = snapToGrid(node.y());
      const nodesLayer = nodesLayerRef.current;
      if (nodesLayer && node.getLayer() !== nodesLayer) {
        node.moveTo(nodesLayer);
      }
      node.position({ x, y });
      nodesLayer?.batchDraw();
      dragLayerRef.current?.batchDraw();
      const nextPositions = {
        ...positionsRef.current,
        [id]: { x, y },
      };
      setDiagramPositions(nextPositions);
    },
    [setDiagramPositions],
  );

  const handleNodeDragStart = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      const dragLayer = dragLayerRef.current;
      if (!dragLayer) {
        return;
      }
      event.target.moveTo(dragLayer);
      nodesLayerRef.current?.batchDraw();
      dragLayer.batchDraw();
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

  const findPortAtPoint = useCallback(
    (worldX: number, worldY: number): DiagramPort | null => {
      for (const item of visibleItems) {
        const pos = positions[item.id];
        if (!pos) {
          continue;
        }
        for (const side of DIAGRAM_PORT_SIDES) {
          const port = getPortPosition(pos, side);
          const distance = Math.hypot(worldX - port.x, worldY - port.y);
          if (distance <= PORT_HIT_RADIUS) {
            return { item, side };
          }
        }
      }
      return null;
    },
    [positions, visibleItems],
  );

  const handlePortMouseDown = useCallback(
    (
      fromId: string,
      fromPort: DiagramPortSide,
      event: KonvaEventObject<MouseEvent>,
    ) => {
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
      setPending({ fromId, fromPort, pointerX: world.x, pointerY: world.y });
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
    const targetPort = findPortAtPoint(pending.pointerX, pending.pointerY);
    if (targetPort && targetPort.item.id !== pending.fromId) {
      setEdges((current) => {
        const exists = current.some(
          (edge) =>
            edge.from === pending.fromId &&
            edge.to === targetPort.item.id &&
            (edge.fromPort ?? "right") === pending.fromPort &&
            (edge.toPort ?? "left") === targetPort.side,
        );
        if (exists) {
          return current;
        }
        const nextEdges = [
          ...current,
          {
            id: `${pending.fromId}-${pending.fromPort}-${targetPort.item.id}-${targetPort.side}-${Date.now()}`,
            from: pending.fromId,
            to: targetPort.item.id,
            fromPort: pending.fromPort,
            toPort: targetPort.side,
          },
        ];
        edgesRef.current = nextEdges;
        emitDiagramState({
          positions: positionsRef.current,
          edges: nextEdges,
          viewport: stageTransformRef.current,
        });
        return nextEdges;
      });
    }
    setPending(null);
  }, [emitDiagramState, pending, findPortAtPoint]);

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
      applyStageTransform({ ...newPos, scale: newScale });
      scheduleViewportPersist();
    },
    [applyStageTransform, scheduleViewportPersist],
  );

  const handleStageDragEnd = useCallback(
    (event: KonvaEventObject<DragEvent>) => {
      if (event.target !== event.target.getStage()) {
        return;
      }
      stageTransformRef.current = {
        x: event.target.x(),
        y: event.target.y(),
        scale: event.target.scaleX(),
      };
      persistCurrentDiagramState();
    },
    [persistCurrentDiagramState],
  );

  const handleEdgeClick = useCallback(
    (edgeId: string) => {
      setEdges((current) => {
        const nextEdges = current.filter((edge) => edge.id !== edgeId);
        edgesRef.current = nextEdges;
        emitDiagramState({
          positions: positionsRef.current,
          edges: nextEdges,
          viewport: stageTransformRef.current,
        });
        return nextEdges;
      });
    },
    [emitDiagramState],
  );

  const handleNodeMouseEnter = useCallback(
    (item: MarkdownItem) => {
      if (item.observation) {
        const pos = positions[item.id];
        if (pos) {
          const stage = stageRef.current;
          if (stage) {
            const transform = stage.getAbsoluteTransform();
            const point = transform.point({
              x: pos.x + DIAGRAM_NODE_WIDTH / 2,
              y: pos.y + DIAGRAM_NODE_HEIGHT,
            });
            setHoveredItem({ item, x: point.x, y: point.y });
          }
        }
      }
    },
    [positions],
  );

  const handleNodeMouseLeave = useCallback(() => {
    setHoveredItem(null);
  }, []);

  const getPortId = useCallback(
    (itemId: string, side: DiagramPortSide) => `${itemId}:${side}`,
    [],
  );

  const handlePortMouseEnter = useCallback(
    (
      itemId: string,
      side: DiagramPortSide,
      event: KonvaEventObject<MouseEvent>,
    ) => {
      setHoveredPortId(getPortId(itemId, side));
      const stage = event.target.getStage();
      if (stage) {
        stage.container().style.cursor = "crosshair";
      }
    },
    [getPortId],
  );

  const handlePortMouseLeave = useCallback(
    (
      itemId: string,
      side: DiagramPortSide,
      event: KonvaEventObject<MouseEvent>,
    ) => {
      const portId = getPortId(itemId, side);
      setHoveredPortId((current) => (current === portId ? null : current));
      const stage = event.target.getStage();
      if (stage) {
        stage.container().style.cursor = "default";
      }
    },
    [getPortId],
  );

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
        draggable={!pending}
        onDragEnd={handleStageDragEnd}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onWheel={handleWheel}
      >
        <Layer listening={visibleEdges.length > 0}>
          {visibleEdges.map((edge) => {
            const fromPos = positions[edge.from];
            const toPos = positions[edge.to];
            if (!fromPos || !toPos) {
              return null;
            }
            const fromPort = edge.fromPort ?? "right";
            const toPort = edge.toPort ?? "left";
            const points =
              edgeStyle === "curve"
                ? getCurveEdgePoints(fromPos, fromPort, toPos, toPort)
                : getSquareEdgePoints(fromPos, fromPort, toPos, toPort);
            const isHover = hoveredEdgeId === edge.id;
            return (
              <Arrow
                key={edge.id}
                points={points}
                stroke={isHover ? edgeHoverColor : edgeColor}
                strokeWidth={
                  isHover ? EDGE_HOVER_STROKE_WIDTH : EDGE_STROKE_WIDTH
                }
                fill={isHover ? edgeHoverColor : edgeColor}
                bezier={edgeStyle === "curve"}
                lineCap="round"
                lineJoin="round"
                perfectDrawEnabled={false}
                shadowForStrokeEnabled={false}
                pointerLength={EDGE_POINTER_SIZE}
                pointerWidth={EDGE_POINTER_SIZE}
                hitStrokeWidth={EDGE_HIT_STROKE_WIDTH}
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
                if (!visibleItemIds.has(pending.fromId)) {
                  return null;
                }
                const fromPos = positions[pending.fromId];
                if (!fromPos) {
                  return null;
                }
                const from = getPortPosition(fromPos, pending.fromPort);
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
                    perfectDrawEnabled={false}
                    shadowForStrokeEnabled={false}
                    pointerLength={8}
                    pointerWidth={8}
                    listening={false}
                  />
                );
              })()
            : null}
        </Layer>

        <Layer ref={nodesLayerRef}>
          {visibleItems.map((item) => {
            const pos = positions[item.id];
            if (!pos) {
              return null;
            }
            const status = item.status ?? "backlog";
            const palette = DIAGRAM_STATUS_PALETTE[status][theme];
            const isActive = item.id === activeItemId;
            const title = getDisplayTitle(item, 70);
            const observationText = item.observation?.trim() || "";
            const observation =
              observationText.length > 50
                ? `${observationText.slice(0, 47)}...`
                : observationText;
            return (
              <Group
                key={item.id}
                x={pos.x}
                y={pos.y}
                draggable
                onDragStart={handleNodeDragStart}
                onDragEnd={(event) => handleNodeDragEnd(item.id, event)}
                onClick={() => onSelectItem(item)}
                onTap={() => onSelectItem(item)}
                onMouseEnter={(event) => {
                  const stage = event.target.getStage();
                  if (stage) {
                    stage.container().style.cursor = "grab";
                    handleNodeMouseEnter(item);
                  }
                }}
                onMouseLeave={(event) => {
                  const stage = event.target.getStage();
                  if (stage) {
                    handleNodeMouseLeave();
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
                  perfectDrawEnabled={false}
                  shadowForStrokeEnabled={false}
                  shadowEnabled={isActive}
                  shadowColor={isDark ? "#000" : "#94a3b8"}
                  shadowBlur={8}
                  shadowOpacity={isDark ? 0.45 : 0.25}
                  shadowOffsetY={2}
                />
                <Text
                  x={12}
                  y={12}
                  width={DIAGRAM_NODE_WIDTH - 24}
                  height={28}
                  text={title}
                  fontSize={13}
                  fontStyle="600"
                  fontFamily="Inter, system-ui, sans-serif"
                  fill={palette.text}
                  lineHeight={1.25}
                  ellipsis
                  wrap="word"
                  listening={false}
                  perfectDrawEnabled={false}
                />
                {observation && (
                  <Text
                    x={12}
                    y={44}
                    width={DIAGRAM_NODE_WIDTH - 24}
                    height={DIAGRAM_NODE_HEIGHT - 56}
                    text={observation}
                    fontSize={11}
                    fontStyle="400"
                    fontFamily="Inter, system-ui, sans-serif"
                    fill={palette.text}
                    lineHeight={1.3}
                    ellipsis
                    wrap="word"
                    listening={false}
                    perfectDrawEnabled={false}
                    opacity={0.85}
                  />
                )}
                {DIAGRAM_PORT_SIDES.map((side) => {
                  const port = getPortPosition({ x: 0, y: 0 }, side);
                  const portId = getPortId(item.id, side);
                  const isHoveredPort = hoveredPortId === portId;
                  return (
                    <Group key={side}>
                      <Circle
                        x={port.x}
                        y={port.y}
                        radius={PORT_HIT_RADIUS}
                        fill="rgba(94, 234, 212, 0.01)"
                        stroke={portColor}
                        strokeWidth={isHoveredPort ? 1.4 : 0}
                        opacity={isHoveredPort ? 0.35 : 1}
                        perfectDrawEnabled={false}
                        onMouseDown={(event) =>
                          handlePortMouseDown(item.id, side, event)
                        }
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
                            fromPort: side,
                            pointerX: world.x,
                            pointerY: world.y,
                          });
                        }}
                        onMouseEnter={(event) =>
                          handlePortMouseEnter(item.id, side, event)
                        }
                        onMouseLeave={(event) =>
                          handlePortMouseLeave(item.id, side, event)
                        }
                      />
                      {isHoveredPort && (
                        <Circle
                          x={port.x}
                          y={port.y}
                          radius={PORT_HOVER_RADIUS}
                          fill="rgba(94, 234, 212, 0.18)"
                          stroke={portColor}
                          strokeWidth={1.6}
                          listening={false}
                          perfectDrawEnabled={false}
                        />
                      )}
                      <Circle
                        x={port.x}
                        y={port.y}
                        radius={PORT_RADIUS}
                        fill={portColor}
                        stroke={isDark ? "#0b0f17" : "#ffffff"}
                        strokeWidth={2}
                        listening={false}
                        perfectDrawEnabled={false}
                      />
                    </Group>
                  );
                })}
              </Group>
            );
          })}
        </Layer>

        <Layer ref={dragLayerRef} listening={false} />
      </Stage>

      <DiagramLegend theme={theme} />

      {items.length === 0 || visibleItems.length === 0 ? (
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center text-sm ${
            isDark ? "text-slate-400" : "text-slate-500"
          }`}
        >
          {items.length === 0
            ? "Adicione cards para visualizar o diagrama."
            : "Nenhum card visivel no diagrama."}
        </div>
      ) : null}

      <div
        className={`pointer-events-none absolute right-3 top-3 rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
          isDark
            ? "border-white/10 bg-ink/70 text-slate-300"
            : "border-slate-200 bg-white/90 text-slate-600"
        }`}
      >
        Arraste cards · bolinhas verdes para ligar · clique na seta para remover
      </div>

      {hoveredItem && (
        <div
          className={`absolute z-50 max-w-xs rounded-md border px-3 py-2 text-xs shadow-lg ${
            isDark
              ? "border-white/20 bg-slate-900 text-slate-100"
              : "border-slate-300 bg-white text-slate-800"
          }`}
          style={{
            left: hoveredItem.x,
            top: hoveredItem.y + 10,
            transform: "translateX(-50%)",
          }}
        >
          {hoveredItem.item.observation}
        </div>
      )}
    </div>
  );
}
