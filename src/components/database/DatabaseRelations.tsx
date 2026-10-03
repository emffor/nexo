"use client";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { AppTheme } from "../../lib/preferences";
import type { UI_THEME } from "../../lib/uiTheme";
import type { ActiveEditor, CurveDragSnapshot } from "../../types/databaseCanvas";

import {
  Circle,
  Group,
  Path,
  Rect,
  Text
} from "react-konva";
import {
  buildCurveMidpoint,
  buildCurvePathDataFromPoints,
  buildCurvePoints,
  buildOrthogonalPath,
  buildOrthogonalPathData,
  buildRelationGuidePoints,
  buildRelationMidpoint,
  buildSegmentHandles,
  chooseRelationSides,
  getColumnAnchor,
  moveLinkedCurveControlPoints,
  moveRelationSegment,
  normalizeRelationPath,
  pointArrayToPairs,
  pointPairsToArray,
} from "../../lib/databaseDiagramGeometry";
import {
  DB_TABLE_WIDTH,
  computeDatabaseTableHeight
} from "../../lib/databaseLayout";
import { buildRoutedDatabasePath, isDatabaseCurveBlocked, isDatabasePathBlocked, routeDatabaseConnection } from "../../lib/databaseRouting";
import type { DiagramEdgeStyle } from "../../lib/preferences";
import { UI_FONT_FAMILY, UI_RADIUS } from "../../lib/uiTheme";
import type {
  DatabaseRelation,
  DatabaseRelationPathState,
  DatabaseRelationSide,
  DatabaseTable,
  DatabaseTablePosition
} from "../../types/database";
import { CardinalityMarker } from "./CardinalityMarker";

interface DatabaseRelationsProps {
  relations: DatabaseRelation[];
  tableLookup: Map<string, DatabaseTable>;
  visualPositions: Record<string, DatabaseTablePosition>;
  visualRelationPaths: Record<string, DatabaseRelationPathState> | undefined;
  selectedRelationId: string | null;
  activeRelationIds: Set<string>;
  editingRelationId: string | null;
  edgeStyle: DiagramEdgeStyle;
  routingObstacles: { width: number; height: number; x: number; y: number; id: string; }[];
  activeEdgeColor: string;
  edgeColor: string;
  colors: (typeof UI_THEME)[AppTheme];
  previewRelationPath: (relationId: string, path: DatabaseRelationPathState) => void;
  commitRelationPath: (relationId: string, path: DatabaseRelationPathState) => void;
  curveDragSnapshotRef: MutableRefObject<CurveDragSnapshot | null>;
  resetRelationPath: (relationId: string) => void;
  setSelectedRelationId: Dispatch<SetStateAction<string | null>>;
  setSelectedTableId: Dispatch<SetStateAction<string | null>>;
  setActiveEditor: Dispatch<SetStateAction<ActiveEditor | null>>;
  setEditingRelationId: Dispatch<SetStateAction<string | null>>;
  saveRelationPath: (relationId: string, path: DatabaseRelationPathState) => void;
  setHoveredRelationId: Dispatch<SetStateAction<string | null>>;
}

export function DatabaseRelations({
  relations,
  tableLookup,
  visualPositions,
  visualRelationPaths,
  selectedRelationId,
  activeRelationIds,
  editingRelationId,
  edgeStyle,
  routingObstacles,
  activeEdgeColor,
  edgeColor,
  colors,
  previewRelationPath,
  commitRelationPath,
  curveDragSnapshotRef,
  resetRelationPath,
  setSelectedRelationId,
  setSelectedTableId,
  setActiveEditor,
  setEditingRelationId,
  saveRelationPath,
  setHoveredRelationId,
}: DatabaseRelationsProps) {
  return <>
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
  </>;
}
