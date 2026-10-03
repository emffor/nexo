"use client";
import { AUTO_LAYOUT_OPTIONS } from "../../lib/databaseCanvas";
import type { DatabaseDiagramPanelProps } from "../../types/databaseCanvas";

import { useDatabaseCanvas } from "../../hooks/useDatabaseCanvas";

import { DatabaseRelations } from "./DatabaseRelations";
import { DatabaseTables } from "./DatabaseTables";

import Konva from "konva";
import {
  Layer,
  Stage
} from "react-konva";

const MIN_SCALE = 0.4;
const MAX_SCALE = 1.8;

const EDITOR_WIDTH = 280;

Konva.pixelRatio = 1;

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
  const {
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
  } = useDatabaseCanvas({ tables, relations, theme, state, onStateChange, onRenameTable, onRenameColumn, edgeStyle, resetSignal });
  return (
    <div
      ref={containerRef}
      className="nexo-surface nexo-canvas-surface relative h-full min-h-[480px] w-full overflow-hidden rounded-2xl border border-[var(--ui-line)] bg-[var(--ui-surface)] shadow-sm"
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
          <DatabaseRelations
            relations={relations}
            tableLookup={tableLookup}
            visualPositions={visualPositions}
            visualRelationPaths={visualRelationPaths}
            selectedRelationId={selectedRelationId}
            activeRelationIds={activeRelationIds}
            editingRelationId={editingRelationId}
            edgeStyle={edgeStyle}
            routingObstacles={routingObstacles}
            activeEdgeColor={activeEdgeColor}
            edgeColor={edgeColor}
            colors={colors}
            previewRelationPath={previewRelationPath}
            commitRelationPath={commitRelationPath}
            curveDragSnapshotRef={curveDragSnapshotRef}
            resetRelationPath={resetRelationPath}
            setSelectedRelationId={setSelectedRelationId}
            setSelectedTableId={setSelectedTableId}
            setActiveEditor={setActiveEditor}
            setEditingRelationId={setEditingRelationId}
            saveRelationPath={saveRelationPath}
            setHoveredRelationId={setHoveredRelationId}
          />
        </Layer>

        <Layer>
          <DatabaseTables
            tables={tables}
            visualPositions={visualPositions}
            selectedTableId={selectedTableId}
            setSelectedTableId={setSelectedTableId}
            setSelectedRelationId={setSelectedRelationId}
            setEditingRelationId={setEditingRelationId}
            handleTableDragMove={handleTableDragMove}
            handleTableDragEnd={handleTableDragEnd}
            setHoveredTableId={setHoveredTableId}
            tableBg={tableBg}
            selectedBorder={selectedBorder}
            tableBorder={tableBorder}
            colors={colors}
            isDark={isDark}
            headerBg={headerBg}
            headerText={headerText}
            openTableEditor={openTableEditor}
            setRecordsTableId={setRecordsTableId}
            relations={relations}
            activeRelationIds={activeRelationIds}
            activeEditor={activeEditor}
            openColumnEditor={openColumnEditor}
            rowHighlight={rowHighlight}
            rowText={rowText}
            typeText={typeText}
            badgeBg={badgeBg}
            badgeText={badgeText}
          />
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
          className="absolute z-50 rounded-2xl border p-3.5 shadow-[var(--ui-shadow-strong)] backdrop-blur-xl border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-heading)]"
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
            className="w-full rounded-xl border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[var(--ui-accent-soft)] border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-heading)]"
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
                className="rounded-xl px-2.5 py-1 text-xs font-medium bg-[var(--ui-raised)] text-[var(--ui-text)] hover:bg-[var(--ui-raised)]"
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
                className="rounded-xl px-2.5 py-1 text-xs text-[var(--ui-muted)] hover:bg-[var(--ui-raised)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[var(--ui-primary)] px-3 py-1 text-xs font-semibold text-[var(--ui-on-primary)] hover:bg-[var(--ui-primary-hover)] shadow-xs"
              >
                Salvar
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {recordsTable?.records ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] backdrop-blur-md p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="database-records-title"
            className="max-h-full w-full max-w-4xl overflow-hidden rounded-2xl border shadow-[var(--ui-shadow-strong)] border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-heading)]"
          >
            <div
              className="flex items-center justify-between border-b px-5 py-3.5 border-[var(--ui-line)]"
            >
              <h2 id="database-records-title" className="text-sm font-semibold tracking-tight">
                Records de {recordsTable.name}
              </h2>
              <button
                type="button"
                onClick={() => setRecordsTableId(null)}
                className="toolbar-button h-7 px-3 text-xs rounded-xl"
              >
                Fechar
              </button>
            </div>
            <div className="max-h-[65vh] overflow-auto p-4">
              <div className="overflow-hidden rounded-xl border border-[var(--ui-line)]">
                <table className="min-w-full border-collapse text-left text-xs">
                  <thead>
                    <tr>
                      {recordsTable.records.columns.map((column) => (
                        <th
                          key={column.name}
                          className="border-b px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider border-[var(--ui-line)] bg-[var(--ui-raised)] text-[var(--ui-muted)]"
                        >
                          {column.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ui-line)]">
                    {recordsTable.records.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="transition-colors hover:bg-[var(--ui-raised)]">
                        {recordsTable.records?.columns.map((column, colIndex) => (
                          <td
                            key={`${rowIndex}-${column.name}`}
                            className="px-4 py-2.5 text-xs text-[var(--ui-text)]"
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
        </div>
      ) : null}

      {isAutoLayoutOpen ? (
        <div
          role="dialog"
          aria-label="Escolher algoritmo de auto-organização"
          className="absolute bottom-16 left-4 z-50 w-[min(28rem,calc(100%-2rem))] overflow-hidden rounded-2xl border shadow-[var(--ui-shadow-strong)] backdrop-blur-2xl border-[var(--ui-glass-border)] bg-[var(--ui-glass)] text-[var(--ui-heading)]"
        >
          <div
            className="border-b px-5 py-3.5 text-sm font-semibold border-[var(--ui-line)] tracking-tight"
          >
            Escolha o algoritmo de auto-organização
          </div>
          <div className="p-2">
            {AUTO_LAYOUT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleApplyAutoLayout(option.id)}
                className="flex w-full items-start gap-4 rounded-xl px-3.5 py-3 text-left transition hover:bg-[var(--ui-raised)]"
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
                  className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold shadow-xs border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-muted)]"
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
        className="absolute bottom-4 left-4 z-40 flex items-center overflow-hidden rounded-2xl border shadow-[var(--ui-shadow-strong)] backdrop-blur-xl border-[var(--ui-line)] bg-[var(--ui-glass)] text-[var(--ui-text)]"
      >
        <button
          type="button"
          onClick={() => handleZoom(-1)}
          disabled={viewportScale <= MIN_SCALE}
          className="flex h-9 w-9 items-center justify-center text-base font-semibold transition hover:bg-[var(--ui-raised)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
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
          className="flex h-9 w-9 items-center justify-center text-base font-semibold transition hover:bg-[var(--ui-raised)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Aumentar zoom"
          title="Aumentar zoom"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setIsAutoLayoutOpen((current) => !current)}
          aria-expanded={isAutoLayoutOpen}
          className={`border-l px-3.5 py-2 text-xs font-semibold transition ${isAutoLayoutOpen
              ? "bg-[var(--ui-primary)] text-[var(--ui-on-primary)]"
              : "border-[var(--ui-line)] hover:bg-[var(--ui-raised)]"
            }`}
        >
          Organizar
        </button>
        <button
          type="button"
          onClick={handleFitToContent}
          className="border-l px-3.5 py-2 text-xs font-semibold transition border-[var(--ui-line)] hover:bg-[var(--ui-raised)]"
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
          className={`border-l px-3.5 py-2 text-xs font-semibold transition ${interactionMode === "pan"
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
