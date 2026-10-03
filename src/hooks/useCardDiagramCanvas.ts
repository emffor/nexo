"use client";
import type { DiagramPanelProps } from "../types/diagramCanvas";

import Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { useCanvasSize } from "../hooks/useCanvasSize";
import {
  resolveDatabaseTablePosition,
  type DatabaseRoutingObstacle
} from "../lib/databaseRouting";
import { getPortPosition } from "../lib/diagramGeometry";
import {
  DIAGRAM_GRID_OFFSET,
  DIAGRAM_NODE_HEIGHT,
  DIAGRAM_NODE_WIDTH,
  computeAutoLayout,
  snapToGrid,
} from "../lib/diagramLayout";
import { readDiagramState } from "../lib/diagramState";
import { UI_THEME } from "../lib/uiTheme";
import type {
  DiagramEdge,
  DiagramNodePosition,
  DiagramPortSide,
  DiagramState,
  DiagramViewport,
} from "../types/diagram";
import type { MarkdownItem } from "../types/markdown";

interface PendingConnection {
  fromId: string;
  fromPort: DiagramPortSide;
  pointerX: number;
  pointerY: number;
}
interface LiveNodePosition {
  id: string;
  x: number;
  y: number;
}
interface DiagramPort {
  item: MarkdownItem;
  side: DiagramPortSide;
}
const MIN_SCALE = 0.4;
const MAX_SCALE = 1.8;
const SCALE_STEP = 1.05;

const PORT_HIT_RADIUS = 22;

const INITIAL_STAGE_TRANSFORM: DiagramViewport = { x: 0, y: 0, scale: 1 };
const DIAGRAM_PORT_SIDES: DiagramPortSide[] = [
  "top",
  "right",
  "bottom",
  "left",
];
export function useCardDiagramCanvas({
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
  initialState,
  onDiagramStateChange,
}: DiagramPanelProps) {
  void _onChangeStatus;
  const { containerRef, size } = useCanvasSize();
  const stageRef = useRef<Konva.Stage | null>(null);

  useEffect(() => {
    if (document.fonts) {
      void document.fonts.ready.then(() => stageRef.current?.batchDraw());
    }
  }, []);

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

  const [positions, setPositions] = useState<
    Record<string, DiagramNodePosition>
  >({});
  const [edges, setEdges] = useState<DiagramEdge[]>([]);
  const [liveNodePosition, setLiveNodePosition] =
    useState<LiveNodePosition | null>(null);
  const [pending, setPending] = useState<PendingConnection | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [hoveredPortId, setHoveredPortId] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<{
    item: MarkdownItem;
    x: number;
    y: number;
  } | null>(null);
  const [viewportScale, setViewportScale] = useState(
    INITIAL_STAGE_TRANSFORM.scale,
  );
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

  const visualPositions = useMemo(() => {
    const result = { ...positions };
    const obstacles: DatabaseRoutingObstacle[] = [];
    for (const item of visibleItems) {
      const position = positions[item.id];
      if (!position) continue;
      const candidate = liveNodePosition?.id === item.id ? liveNodePosition : position;
      const resolved = resolveDatabaseTablePosition(
        candidate, DIAGRAM_NODE_WIDTH, DIAGRAM_NODE_HEIGHT, obstacles,
      );
      result[item.id] = resolved;
      obstacles.push({ ...resolved, width: DIAGRAM_NODE_WIDTH, height: DIAGRAM_NODE_HEIGHT });
    }
    return result;
  }, [liveNodePosition, positions, visibleItems]);

  const routingObstacles = useMemo(() => visibleItems.flatMap((item) => {
    const position = visualPositions[item.id];
    return position ? [{ id: item.id, ...position, width: DIAGRAM_NODE_WIDTH, height: DIAGRAM_NODE_HEIGHT }] : [];
  }), [visualPositions, visibleItems]);

  const constrainNodePosition = useCallback((id: string, position: DiagramNodePosition) =>
    resolveDatabaseTablePosition(position, DIAGRAM_NODE_WIDTH, DIAGRAM_NODE_HEIGHT,
      routingObstacles.filter((obstacle) => obstacle.id !== id)),
    [routingObstacles]);

  const emitDiagramState = useCallback(
    (state: DiagramState) => {
      onDiagramStateChange?.(state);
    },
    [onDiagramStateChange],
  );

  const applyStageTransform = useCallback((transform: DiagramViewport) => {
    stageTransformRef.current = transform;
    setViewportScale(transform.scale);
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
    const stored = initialState ?? readDiagramState();
    positionsRef.current = stored.positions;
    edgesRef.current = stored.edges;
    setPositions(stored.positions);
    setEdges(stored.edges);
    applyStageTransform(stored.viewport ?? INITIAL_STAGE_TRANSFORM);
    setIsHydrated(true);
  }, [applyStageTransform, initialState]);

  // hidratar estado salvo
  useEffect(() => {
    loadStoredDiagramState();
  }, [loadStoredDiagramState, reloadStateSignal]);

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
    positionsRef.current = positions;
  }, [positions]);

  useEffect(() => {
    if (!liveNodePosition) {
      return;
    }

    const persisted = positions[liveNodePosition.id];
    if (
      persisted &&
      persisted.x === liveNodePosition.x &&
      persisted.y === liveNodePosition.y
    ) {
      setLiveNodePosition(null);
    }
  }, [liveNodePosition, positions]);

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
    if (!isHydrated) {
      return;
    }
    const validIds = new Set(items.map((item) => item.id));
    setEdges((current) => {
      const next = current.filter(
        (edge) => validIds.has(edge.from) && validIds.has(edge.to),
      );
      if (next.length === current.length) {
        return current;
      }
      edgesRef.current = next;
      return next;
    });
  }, [items, isHydrated]);

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
        emitDiagramState({
          positions: positionsRef.current,
          edges: edgesRef.current,
          viewport: stageTransformRef.current,
        });
      }
    };
  }, [positions, edges, emitDiagramState, isHydrated]);

  useEffect(() => {
    return () => {
      if (viewportPersistTimerRef.current) {
        clearTimeout(viewportPersistTimerRef.current);
        emitDiagramState({
          positions: positionsRef.current,
          edges: edgesRef.current,
          viewport: stageTransformRef.current,
        });
      }
    };
  }, [emitDiagramState]);

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

  const handleNodeDragEnd = useCallback(
    (id: string, event: KonvaEventObject<DragEvent>) => {
      const node = event.target;
      const { x, y } = constrainNodePosition(id, {
        x: snapToGrid(node.x()), y: snapToGrid(node.y()),
      });
      const nodesLayer = nodesLayerRef.current;
      if (nodesLayer && node.getLayer() !== nodesLayer) {
        node.moveTo(nodesLayer);
      }
      node.position({ x, y });
      setLiveNodePosition({ id, x, y });
      nodesLayer?.batchDraw();
      dragLayerRef.current?.batchDraw();
      const nextPositions = {
        ...visualPositions,
        [id]: { x, y },
      };
      setDiagramPositions(nextPositions);
    },
    [constrainNodePosition, setDiagramPositions, visualPositions],
  );

  const handleNodeDragMove = useCallback(
    (id: string, event: KonvaEventObject<DragEvent>) => {
      const node = event.target;
      const position = constrainNodePosition(id, { x: node.x(), y: node.y() });
      node.position(position);
      setLiveNodePosition({ id, ...position });
    },
    [constrainNodePosition],
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
        const pos = visualPositions[item.id];
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
    [visualPositions, visibleItems],
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
      applyStageTransform({ ...newPos, scale: newScale });
      scheduleViewportPersist();
    },
    [applyStageTransform, scheduleViewportPersist],
  );

  const handleZoom = useCallback(
    (direction: 1 | -1) => {
      const current = stageTransformRef.current;
      const oldScale = current.scale;
      const rawScale =
        direction > 0 ? oldScale * SCALE_STEP : oldScale / SCALE_STEP;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, rawScale));
      if (newScale === oldScale) {
        return;
      }
      const center = {
        x: size.width / 2,
        y: size.height / 2,
      };
      const worldCenter = {
        x: (center.x - current.x) / oldScale,
        y: (center.y - current.y) / oldScale,
      };
      const nextTransform = {
        x: center.x - worldCenter.x * newScale,
        y: center.y - worldCenter.y * newScale,
        scale: newScale,
      };
      applyStageTransform(nextTransform);
      scheduleViewportPersist();
    },
    [applyStageTransform, scheduleViewportPersist, size.height, size.width],
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
        const pos = visualPositions[item.id];
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
    [visualPositions],
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
  const colors = UI_THEME[theme];
  const stageBg = colors.canvas;
  const edgeColor = colors.edge;
  const edgeHoverColor = colors.danger;
  const portColor = colors.accent;

  return {
    containerRef,
    size,
    stageRef,
    nodesLayerRef,
    dragLayerRef,
    pending,
    setPending,
    hoveredEdgeId,
    setHoveredEdgeId,
    hoveredPortId,
    hoveredItem,
    viewportScale,
    visibleItems,
    visibleItemIds,
    visibleEdges,
    visualPositions,
    routingObstacles,
    handleNodeDragEnd,
    handleNodeDragMove,
    handleNodeDragStart,
    stageToWorld,
    findPortAtPoint,
    handlePortMouseDown,
    handleStageMouseMove,
    handleStageMouseUp,
    handleWheel,
    handleZoom,
    handleStageDragEnd,
    handleEdgeClick,
    handleNodeMouseEnter,
    handleNodeMouseLeave,
    getPortId,
    handlePortMouseEnter,
    handlePortMouseLeave,
    isDark,
    colors,
    stageBg,
    edgeColor,
    edgeHoverColor,
    portColor,
  };
}
