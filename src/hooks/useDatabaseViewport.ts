"use client";
import { useCallback, useEffect, useState, type MutableRefObject } from "react";
import type Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import type { DatabaseDiagramViewport, DatabaseDiagramVisualState, DatabaseTable } from "../types/database";
import { DB_TABLE_WIDTH, computeDatabaseTableHeight } from "../lib/databaseLayout";
import { databaseGroupBounds, databaseNotePosition, databaseNoteHeight } from "../lib/databaseCanvas";
import type { DatabaseStickyNote, DatabaseTableGroup } from "../types/database";
import { clamp } from "../lib/databaseDiagramGeometry";

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.8;
const SCALE_STEP = 1.05;
const INITIAL_VIEWPORT: DatabaseDiagramViewport = { x: 0, y: 0, scale: 1 };

interface DatabaseViewportOptions {
  stageRef: MutableRefObject<Konva.Stage | null>;
  stateRef: MutableRefObject<DatabaseDiagramVisualState>;
  state: DatabaseDiagramVisualState;
  size: { width: number; height: number };
  tables: DatabaseTable[];
  notes?: DatabaseStickyNote[];
  groups?: DatabaseTableGroup[];
  onStateChange: (state: DatabaseDiagramVisualState) => void;
}

export function useDatabaseViewport({ stageRef, stateRef, state, size, tables, notes, groups, onStateChange }: DatabaseViewportOptions) {
  const [viewportScale, setViewportScale] = useState(state.viewport?.scale ?? INITIAL_VIEWPORT.scale);
  const viewport = state.viewport ?? INITIAL_VIEWPORT;
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.position({ x: viewport.x, y: viewport.y });
    stage.scale({ x: viewport.scale, y: viewport.scale });
    setViewportScale(viewport.scale);
    stage.batchDraw();
  }, [stageRef, viewport.x, viewport.y, viewport.scale]);

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
    [onStateChange, stateRef],
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
    [onStateChange, stageRef, stateRef],
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
    [onStateChange, size.height, size.width, stageRef, stateRef],
  );

  const buildFitViewport = useCallback(
    (positions: DatabaseDiagramVisualState["positions"]) => {
      if (tables.length === 0 && !notes?.length) {
        return null;
      }

      const collapsedGroups = stateRef.current.collapsedGroups ?? [];
      const hiddenTables = new Set((groups ?? []).filter((group) => collapsedGroups.includes(group.name)).flatMap((group) => group.tables.map((member) => member.name)));
      const bounds = tables.filter((table) => !hiddenTables.has(table.name)).reduce(
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
      for (const group of groups ?? []) {
        const rect = databaseGroupBounds(group, tables, positions, collapsedGroups.includes(group.name));
        if (!rect) continue;
        bounds.minX = Math.min(bounds.minX, rect.x);
        bounds.minY = Math.min(bounds.minY, rect.y);
        bounds.maxX = Math.max(bounds.maxX, rect.x + rect.width);
        bounds.maxY = Math.max(bounds.maxY, rect.y + rect.height);
      }
      for (const [index, note] of (notes ?? []).entries()) {
        const position = stateRef.current.notePositions?.[note.name] ?? databaseNotePosition(positions, index);
        bounds.minX = Math.min(bounds.minX, position.x);
        bounds.minY = Math.min(bounds.minY, position.y);
        bounds.maxX = Math.max(bounds.maxX, position.x + 240);
        bounds.maxY = Math.max(bounds.maxY, position.y + databaseNoteHeight(note.text));
      }
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
    [size.height, size.width, tables, notes, groups, stateRef],
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
  }, [stageRef]);

  const handleFitToContent = useCallback(() => {
    const current = stateRef.current;
    const next = buildFitViewport(current.positions);
    if (!next) {
      return;
    }
    applyViewport(next);
    onStateChange({ ...current, viewport: next });
  }, [applyViewport, buildFitViewport, onStateChange, stateRef]);

  return {
    viewportScale, handleStageDragEnd, handleWheel, handleZoom,
    buildFitViewport, applyViewport, handleFitToContent
  };
}
