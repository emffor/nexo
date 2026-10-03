"use client";
import { useDatabaseViewport } from "./useDatabaseViewport";

import { AUTO_LAYOUT_OPTIONS } from "../lib/databaseCanvas";
import type { DatabaseDiagramPanelProps } from "../types/databaseCanvas";

import Konva from "konva";
import type { KonvaEventObject } from "konva/lib/Node";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useCanvasSize } from "../hooks/useCanvasSize";
import { clamp, columnYCenter, relationTouchesTable } from "../lib/databaseDiagramGeometry";
import { reanchorRelationPathsForMovedTable } from "../lib/databaseDiagramSync";
import {
  DB_TABLE_WIDTH,
  computeDatabaseAutoLayout,
  computeDatabaseAutoLayoutByAlgorithm,
  computeDatabaseTableHeight,
  type DatabaseAutoLayoutAlgorithm
} from "../lib/databaseLayout";
import { resolveDatabaseTablePosition, type DatabaseRoutingObstacle } from "../lib/databaseRouting";
import {
  isValidDbmlColumnIdentifier,
  isValidDbmlIdentifier,
} from "../lib/dbml";
import { UI_THEME } from "../lib/uiTheme";
import type {
  DatabaseDiagramViewport,
  DatabaseRelationPathState,
  DatabaseTable,
  DatabaseTablePosition
} from "../types/database";
import type { ActiveEditor, CurveDragSnapshot, LiveRelationPath, LiveTablePosition } from "../types/databaseCanvas";

const INITIAL_VIEWPORT: DatabaseDiagramViewport = { x: 0, y: 0, scale: 1 };
const EDITOR_WIDTH = 280;
type InteractionMode = "select" | "pan";

export function useDatabaseCanvas({
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
  const { containerRef, size } = useCanvasSize();
  const stageRef = useRef<Konva.Stage | null>(null);

  useEffect(() => {
    if (document.fonts) {
      void document.fonts.ready.then(() => stageRef.current?.batchDraw());
    }
  }, []);

  const lastResetRef = useRef(resetSignal);
  const stateRef = useRef(state);
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

  const { viewportScale, handleStageDragEnd, handleWheel, handleZoom,
    buildFitViewport, applyViewport, handleFitToContent } = useDatabaseViewport({
      stageRef, stateRef, state, size, tables, onStateChange,
    });

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

  return {
    containerRef,
    size,
    stageRef,
    viewportScale,
    interactionMode,
    setInteractionMode,
    isAutoLayoutOpen,
    setIsAutoLayoutOpen,
    selectedTableId,
    setSelectedTableId,
    selectedRelationId,
    setSelectedRelationId,
    editingRelationId,
    setEditingRelationId,
    setHoveredTableId,
    setHoveredRelationId,
    activeEditor,
    setActiveEditor,
    setRecordsTableId,
    curveDragSnapshotRef,
    visualPositions,
    routingObstacles,
    handleTableDragEnd,
    handleTableDragMove,
    saveRelationPath,
    previewRelationPath,
    commitRelationPath,
    resetRelationPath,
    handleStageDragEnd,
    handleWheel,
    handleZoom,
    handleFitToContent,
    handleApplyAutoLayout,
    openTableEditor,
    openColumnEditor,
    handleSubmitEditor,
    isDark,
    colors,
    stageBg,
    tableBg,
    tableBorder,
    headerBg,
    headerText,
    rowText,
    typeText,
    edgeColor,
    activeEdgeColor,
    badgeBg,
    badgeText,
    rowHighlight,
    selectedBorder,
    tableLookup,
    visualRelationPaths,
    activeRelationIds,
    activeEditorTable,
    editorLeft,
    editorTop,
    recordsTable,
  };
}
