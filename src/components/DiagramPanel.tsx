"use client";
import type { DiagramPanelProps } from "../types/diagramCanvas";

import { useCardDiagramCanvas } from "../hooks/useCardDiagramCanvas";

import { getCurveEdgePoints, getPortPosition, getSquareEdgePoints } from "../lib/diagramGeometry";

import Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import { Arrow, Circle, Group, Layer, Path, Rect, Stage, Text } from "react-konva";

import { UI_FONT_FAMILY, UI_RADIUS } from "../lib/uiTheme";

import {
  buildRoutedDatabasePath,
  isDatabaseCurveBlocked,
  isDatabasePathBlocked,
  routeDatabaseConnection
} from "../lib/databaseRouting";
import {
  DIAGRAM_NODE_HEIGHT,
  DIAGRAM_NODE_WIDTH
} from "../lib/diagramLayout";
import { getDisplayTitle } from "../lib/items";
import type {
  DiagramPortSide
} from "../types/diagram";
import { DIAGRAM_STATUS_PALETTE } from "../types/diagram";
import { DiagramLegend } from "./DiagramLegend";

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.8;

const PORT_RADIUS = 6;
const PORT_HOVER_RADIUS = 10;
const PORT_HIT_RADIUS = 22;
const EDGE_STROKE_WIDTH = 2.4;
const EDGE_HOVER_STROKE_WIDTH = 3.2;
const EDGE_POINTER_SIZE = 12;
const EDGE_HIT_STROKE_WIDTH = 18;

const DIAGRAM_PORT_SIDES: DiagramPortSide[] = [
  "top",
  "right",
  "bottom",
  "left",
];

if (typeof window !== "undefined") {
  Konva.pixelRatio = Math.max(window.devicePixelRatio || 1, 2);
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
  initialState,
  onDiagramStateChange,
}: DiagramPanelProps) {
  const {
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
  } = useCardDiagramCanvas({
    items,
    theme,
    activeItemId,
    hiddenItemIds,
    edgeStyle,
    onSelectItem,
    onChangeStatus: _onChangeStatus,
    scrollContainerRef,
    resetLayoutSignal,
    clearEdgesSignal,
    reloadStateSignal,
    initialState,
    onDiagramStateChange,
  });
  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        if (scrollContainerRef) {
          (scrollContainerRef as { current: HTMLDivElement | null }).current =
            el;
        }
      }}
      className="nexo-surface nexo-canvas-surface relative h-full min-h-[480px] w-full overflow-hidden rounded-2xl border border-[var(--ui-line)] bg-[var(--ui-surface)] shadow-sm"
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
            const fromPos = visualPositions[edge.from];
            const toPos = visualPositions[edge.to];
            if (!fromPos || !toPos) {
              return null;
            }
            const fromPort = edge.fromPort ?? "right";
            const toPort = edge.toPort ?? "left";
            const points =
              edgeStyle === "curve"
                ? getCurveEdgePoints(fromPos, fromPort, toPos, toPort)
                : getSquareEdgePoints(fromPos, fromPort, toPos, toPort);
            const pathPoints = Array.from({ length: points.length / 2 }, (_, index) => ({
              x: points[index * 2], y: points[index * 2 + 1],
            }));
            const blocked = edgeStyle === "curve"
              ? isDatabaseCurveBlocked(pathPoints, routingObstacles)
              : isDatabasePathBlocked(pathPoints, routingObstacles);
            const routed = blocked ? routeDatabaseConnection(
              getPortPosition(fromPos, fromPort), fromPort,
              getPortPosition(toPos, toPort), toPort, routingObstacles,
            ) : null;
            if (blocked && !routed) return null;
            const isHover = hoveredEdgeId === edge.id;
            const appearance = {
              stroke: isHover ? edgeHoverColor : edgeColor,
              strokeWidth: isHover ? EDGE_HOVER_STROKE_WIDTH : EDGE_STROKE_WIDTH,
              hitStrokeWidth: EDGE_HIT_STROKE_WIDTH,
              lineCap: "round" as const,
              lineJoin: "round" as const,
              perfectDrawEnabled: false,
              shadowForStrokeEnabled: false,
            };
            const events = {
              onMouseEnter: (event: KonvaEventObject<MouseEvent>) => {
                setHoveredEdgeId(edge.id);
                const stage = event.target.getStage();
                if (stage) stage.container().style.cursor = "pointer";
              },
              onMouseLeave: (event: KonvaEventObject<MouseEvent>) => {
                setHoveredEdgeId((current) => current === edge.id ? null : current);
                const stage = event.target.getStage();
                if (stage) stage.container().style.cursor = "default";
              },
              onClick: () => handleEdgeClick(edge.id),
              onTap: () => handleEdgeClick(edge.id),
            };
            const curvedRoute = routed && edgeStyle === "curve";
            let arrowPoints = routed ? routed.flatMap((point) => [point.x, point.y]) : points;
            if (curvedRoute) {
              const end = routed[routed.length - 1];
              const before = routed[routed.length - 2];
              const length = Math.hypot(end.x - before.x, end.y - before.y);
              const headLength = Math.min(EDGE_POINTER_SIZE, length / 2);
              arrowPoints = [
                end.x + (before.x - end.x) * headLength / length,
                end.y + (before.y - end.y) * headLength / length,
                end.x, end.y,
              ];
            }
            return (
              <Group key={edge.id}>
                {curvedRoute && (
                  <Path data={buildRoutedDatabasePath(routed, true)} {...appearance} {...events} />
                )}
                <Arrow
                  points={arrowPoints}
                  {...appearance}
                  {...events}
                  fill={appearance.stroke}
                  bezier={!routed && edgeStyle === "curve"}
                  pointerLength={EDGE_POINTER_SIZE}
                  pointerWidth={EDGE_POINTER_SIZE}
                />
              </Group>
            );
          })}

          {pending
            ? (() => {
              if (!visibleItemIds.has(pending.fromId)) {
                return null;
              }
              const fromPos = visualPositions[pending.fromId];
              if (!fromPos) {
                return null;
              }
              const from = getPortPosition(fromPos, pending.fromPort);
              const targetPort = findPortAtPoint(pending.pointerX, pending.pointerY);
              const to = targetPort
                ? getPortPosition(visualPositions[targetPort.item.id], targetPort.side)
                : { x: pending.pointerX, y: pending.pointerY };
              const toSide = targetPort?.side ?? (
                Math.abs(to.x - from.x) > Math.abs(to.y - from.y)
                  ? (to.x > from.x ? "left" : "right")
                  : (to.y > from.y ? "top" : "bottom")
              );
              const route = routeDatabaseConnection(from, pending.fromPort, to, toSide, routingObstacles);
              if (!route) return null;
              return (
                <Arrow
                  points={route.flatMap((point) => [point.x, point.y])}
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
            const pos = visualPositions[item.id];
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
                onDragMove={(event) => handleNodeDragMove(item.id, event)}
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
                  cornerRadius={UI_RADIUS}
                  fill={palette.fill}
                  stroke={isActive ? colors.accent : palette.border}
                  strokeWidth={isActive ? 2.4 : 1.4}
                  perfectDrawEnabled={false}
                  shadowForStrokeEnabled={false}
                  shadowEnabled={isActive}
                  shadowColor={colors.shadowColor}
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
                  fontFamily={UI_FONT_FAMILY}
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
                    fontFamily={UI_FONT_FAMILY}
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
                        fill={colors.accent}
                        stroke={portColor}
                        strokeWidth={isHoveredPort ? 1.4 : 0}
                        opacity={isHoveredPort ? 0.35 : 0.01}
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
                          fill={colors.accent}
                          opacity={0.18}
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
                        stroke={colors.surface}
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
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-[var(--ui-muted)]"
        >
          {items.length === 0
            ? "Adicione cards para visualizar o diagrama."
            : "Nenhum card visivel no diagrama."}
        </div>
      ) : null}

      <div
        className="pointer-events-none absolute right-3 top-3 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.16em] border-[var(--ui-line)] bg-[var(--ui-glass)] backdrop-blur-md text-[var(--ui-muted)] shadow-xs"
      >
        Arraste cards · pontos de conexão para ligar · clique na seta para remover
      </div>

      <div
        className="absolute bottom-24 right-6 z-40 flex flex-col items-center overflow-hidden rounded-2xl border shadow-[var(--ui-shadow-strong)] backdrop-blur-xl border-[var(--ui-line)] bg-[var(--ui-glass)] text-[var(--ui-text)]"
      >
        <button
          type="button"
          onClick={() => handleZoom(1)}
          disabled={viewportScale >= MAX_SCALE}
          className="flex h-8 w-8 items-center justify-center text-sm font-semibold transition hover:bg-[var(--ui-raised)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Aumentar zoom do diagrama"
          title="Aumentar zoom"
        >
          +
        </button>
        <div
          className="border-y px-2.5 py-1 text-[10px] font-semibold tabular-nums border-[var(--ui-line)]"
          title="Zoom: Ctrl/⌘ + rolagem ou botões − e +"
        >
          {Math.round(viewportScale * 100)}%
        </div>
        <button
          type="button"
          onClick={() => handleZoom(-1)}
          disabled={viewportScale <= MIN_SCALE}
          className="flex h-8 w-8 items-center justify-center text-sm font-semibold transition hover:bg-[var(--ui-raised)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Diminuir zoom do diagrama"
          title="Diminuir zoom"
        >
          -
        </button>
      </div>

      {hoveredItem && (
        <div
          className="absolute z-50 max-w-xs rounded-xl border px-3 py-2 text-xs shadow-[var(--ui-shadow-strong)] backdrop-blur-xl border-[var(--ui-line)] bg-[var(--ui-glass)] text-[var(--ui-text)]"
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
