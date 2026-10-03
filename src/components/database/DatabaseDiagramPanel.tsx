"use client";
import { DatabaseInspector, type DatabaseInspection } from "./DatabaseInspector";
import { setDbmlColor, type DatabaseColorTarget } from "../../lib/dbml";
import { useState } from "react";
import { downloadTextFile } from "../../lib/textFiles";
import { DatabaseAnnotations } from "./DatabaseAnnotations";
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
  groups = [],
  notes = [],
  enums = [],
  content = "",
  onContentChange,
  tables,
  relations,
  theme,
  state,
  onStateChange,
  onRenameTable,
  onRenameColumn,
  edgeStyle = "square",
  resetSignal = 0,
  editor,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: DatabaseDiagramPanelProps) {
  const [colorTarget, setColorTarget] = useState<DatabaseColorTarget | null>(null);
  const [inspection, setInspection] = useState<DatabaseInspection | null>(null);
  const hiddenTables = new Set(groups.filter((group) => state.collapsedGroups?.includes(group.name)).flatMap((group) => group.tables.map((member) => member.name)));
  const visibleTables = tables.filter((table) => !hiddenTables.has(table.name));
  const visibleRelations = relations.filter((relation) => !hiddenTables.has(relation.fromTable) && !hiddenTables.has(relation.toTable));
  const openColor = onContentChange ? (target: DatabaseColorTarget) => { setInspection(null); setColorTarget(target); } : undefined;
  const inspect = (next: DatabaseInspection) => { setColorTarget(null); setInspection(next); };
  const toggleGroup = (name: string) => {
    const collapsed = state.collapsedGroups ?? [];
    onStateChange({ ...state, collapsedGroups: collapsed.includes(name) ? collapsed.filter((entry) => entry !== name) : [...collapsed, name] });
  };
  const [showGrid, setShowGrid] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
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
  } = useDatabaseCanvas({ tables, notes, groups, relations, theme, state, onStateChange, onRenameTable, onRenameColumn, edgeStyle, resetSignal });

  const handleExportPng = () => {
    try {
      const stage = stageRef.current;
      if (!stage) return;
      const anchor = document.createElement('a');
      const canvas = stage.toCanvas({ pixelRatio: 2 });
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas indisponível');
      context.globalCompositeOperation = 'destination-over';
      if (showGrid) {
        const spacing = 40 * viewportScale;
        context.strokeStyle = tableBorder;
        context.globalAlpha = 0.4;
        context.beginPath();
        for (let x = ((stage.x() * 2) % spacing + spacing) % spacing; x < canvas.width; x += spacing) {
          context.moveTo(x, 0);
          context.lineTo(x, canvas.height);
        }
        for (let y = ((stage.y() * 2) % spacing + spacing) % spacing; y < canvas.height; y += spacing) {
          context.moveTo(0, y);
          context.lineTo(canvas.width, y);
        }
        context.stroke();
        context.globalAlpha = 1;
      }
      context.fillStyle = stageBg;
      context.fillRect(0, 0, canvas.width, canvas.height);
      anchor.href = canvas.toDataURL('image/png');
      anchor.download = 'diagrama.png';
      anchor.click();
      setExportError(null);
    } catch {
      setExportError('Não foi possível exportar a imagem.');
    }
  };

  return (
    <div className="flex h-full w-full flex-col min-h-0">
      {/* Barra de cabeçalho da Modelagem (Foto 2) */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-[var(--ui-heading)] tracking-tight">
            Modelagem do banco de dados
          </h2>
          <p className="text-xs text-[var(--ui-muted)]">
            {tables.length} tabelas · {relations.length} relações
          </p>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 rounded-xl border border-[var(--ui-line)] bg-[var(--ui-surface)] p-1 shadow-xs text-xs text-[var(--ui-text)]">
          {/* Desfazer */}
          <button
            type="button"
            className="toolbar-button flex h-7 w-7 items-center justify-center p-0 rounded-lg hover:bg-[var(--ui-raised)] disabled:opacity-30 transition-colors"
            aria-label="Desfazer"
            title="Desfazer (Ctrl/⌘ Z)"
            disabled={!canUndo}
            onClick={onUndo}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6" />
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
            </svg>
          </button>

          {/* Refazer */}
          <button
            type="button"
            className="toolbar-button flex h-7 w-7 items-center justify-center p-0 rounded-lg hover:bg-[var(--ui-raised)] disabled:opacity-30 transition-colors"
            aria-label="Refazer"
            title="Refazer (Ctrl/⌘ Shift Z)"
            disabled={!canRedo}
            onClick={onRedo}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 7v6h-6" />
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
            </svg>
          </button>

          <div className="mx-0.5 h-4 w-px bg-[var(--ui-line)]" />

          {/* Diminuir zoom */}
          <button
            type="button"
            className="toolbar-button flex h-7 w-7 items-center justify-center p-0 rounded-lg hover:bg-[var(--ui-raised)] disabled:opacity-30 transition-colors"
            onClick={() => handleZoom(-1)}
            disabled={viewportScale <= MIN_SCALE}
            aria-label="Diminuir zoom"
            title="Diminuir zoom"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

          {/* Percentual de zoom */}
          <span className="min-w-[38px] text-center text-xs font-semibold tabular-nums text-[var(--ui-heading)]">
            {Math.round(viewportScale * 100)}%
          </span>

          {/* Aumentar zoom */}
          <button
            type="button"
            className="toolbar-button flex h-7 w-7 items-center justify-center p-0 rounded-lg hover:bg-[var(--ui-raised)] disabled:opacity-30 transition-colors"
            onClick={() => handleZoom(1)}
            disabled={viewportScale >= MAX_SCALE}
            aria-label="Aumentar zoom"
            title="Aumentar zoom"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

          {/* Reset zoom / 100% */}
          <button
            type="button"
            className="toolbar-button flex h-7 w-7 items-center justify-center p-0 rounded-lg hover:bg-[var(--ui-raised)] transition-colors"
            onClick={() => onStateChange({ ...state, viewport: { x: 0, y: 0, scale: 1 } })}
            aria-label="Zoom 100%"
            title="Zoom 100% / Centralizar"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>

          <div className="mx-0.5 h-4 w-px bg-[var(--ui-line)]" />

          {/* Grade */}
          <button
            type="button"
            className={`toolbar-button flex h-7 w-7 items-center justify-center p-0 rounded-lg transition-colors ${
              showGrid
                ? "bg-[var(--ui-raised)] text-[var(--ui-heading)] font-semibold shadow-xs border border-[var(--ui-line)]"
                : "hover:bg-[var(--ui-raised)] text-[var(--ui-muted)]"
            }`}
            aria-pressed={showGrid}
            aria-label="Grade"
            title="Alternar grade"
            onClick={() => setShowGrid(!showGrid)}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </button>

          {/* Organizar */}
          <button
            type="button"
            className={`toolbar-button flex h-7 w-7 items-center justify-center p-0 rounded-lg transition-colors ${
              isAutoLayoutOpen
                ? "bg-[var(--ui-raised)] text-[var(--ui-heading)] font-semibold shadow-xs border border-[var(--ui-line)]"
                : "hover:bg-[var(--ui-raised)] text-[var(--ui-muted)]"
            }`}
            aria-expanded={isAutoLayoutOpen}
            aria-label="Organizar"
            title="Organizar layout"
            onClick={() => setIsAutoLayoutOpen((prev) => !prev)}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="18" r="3" />
              <circle cx="6" cy="6" r="3" />
              <path d="M6 9v12" />
              <path d="M18 15a9 9 0 0 0-9-9" />
            </svg>
          </button>

          {/* DBML ↓ */}
          <button
            type="button"
            className="toolbar-button flex h-7 w-7 items-center justify-center p-0 rounded-lg hover:bg-[var(--ui-raised)] text-[var(--ui-muted)] hover:text-[var(--ui-heading)] transition-colors"
            aria-label="DBML ↓"
            title="Exportar DBML"
            onClick={() => downloadTextFile('diagrama.dbml', content)}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 18l6-6-6-6" />
              <path d="M8 6l-6 6 6 6" />
              <path d="M12 11v6m0 0l-2-2m2 2l2-2" />
            </svg>
          </button>

          {/* PNG ↓ */}
          <button
            type="button"
            className="toolbar-button flex h-7 w-7 items-center justify-center p-0 rounded-lg hover:bg-[var(--ui-raised)] text-[var(--ui-muted)] hover:text-[var(--ui-heading)] transition-colors"
            aria-label="PNG ↓"
            title="Exportar área visível em PNG"
            onClick={handleExportPng}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>

          {/* Ajuda */}
          <button
            type="button"
            className={`toolbar-button flex h-7 w-7 items-center justify-center p-0 rounded-lg transition-colors ${
              showHelp
                ? "bg-[var(--ui-raised)] text-[var(--ui-heading)] font-semibold shadow-xs border border-[var(--ui-line)]"
                : "hover:bg-[var(--ui-raised)] text-[var(--ui-muted)]"
            }`}
            aria-expanded={showHelp}
            aria-label="Ajuda"
            title="Ajuda"
            onClick={() => setShowHelp(!showHelp)}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>

          {/* Estrutura */}
          <button
            type="button"
            className={`toolbar-button flex h-7 w-7 items-center justify-center p-0 rounded-lg transition-colors ${
              showDetails
                ? "bg-[var(--ui-raised)] text-[var(--ui-heading)] font-semibold shadow-xs border border-[var(--ui-line)]"
                : "hover:bg-[var(--ui-raised)] text-[var(--ui-muted)]"
            }`}
            aria-pressed={showDetails}
            aria-label="Estrutura"
            title="Estrutura do banco"
            onClick={() => setShowDetails(!showDetails)}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>

          <div className="mx-0.5 h-4 w-px bg-[var(--ui-line)]" />

          {/* Mover / Selecionar (Hand) */}
          <button
            type="button"
            className={`toolbar-button flex h-7 w-7 items-center justify-center p-0 rounded-lg transition-colors ${
              interactionMode === "pan"
                ? "bg-[var(--ui-raised)] text-[var(--ui-heading)] font-semibold shadow-xs border border-[var(--ui-line)]"
                : "hover:bg-[var(--ui-raised)] text-[var(--ui-muted)]"
            }`}
            aria-pressed={interactionMode === "pan"}
            aria-label={interactionMode === "pan" ? "Mover canvas" : "Selecionar"}
            title={interactionMode === "pan" ? "Mover canvas" : "Selecionar"}
            onClick={() => setInteractionMode((current) => (current === "pan" ? "select" : "pan"))}
          >
            <HandIcon />
          </button>
        </div>
      </div>

      {/* Conteúdo: Editor (à esquerda) + Canvas (à direita) */}
      <div className="flex flex-1 min-h-0 gap-3">
        {editor ? (
          <div className="w-[340px] shrink-0 h-full">
            {editor}
          </div>
        ) : null}

        <div
          ref={containerRef}
          className="nexo-surface nexo-canvas-surface relative h-full min-h-[480px] flex-1 overflow-hidden rounded-2xl border border-[var(--ui-line)] bg-[var(--ui-surface)] shadow-sm"
          style={{ backgroundColor: stageBg }}
        >
          {showGrid && <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{
            backgroundImage: isDark
              ? 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)'
              : 'linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)',
            backgroundSize: `${20 * viewportScale}px ${20 * viewportScale}px`,
            backgroundPosition: `${state.viewport?.x ?? 0}px ${state.viewport?.y ?? 0}px`,
          }} />}
          {exportError && <p role="alert" className="absolute right-4 top-4 z-50 bg-[var(--ui-surface)] p-3 text-sm rounded-xl border border-[var(--ui-line)] shadow-md">{exportError}</p>}
          {showHelp && <section aria-label="Ajuda do diagrama" className="absolute right-4 top-4 z-50 max-h-[70%] w-80 max-w-[calc(100%-2rem)] overflow-auto rounded-xl border border-[var(--ui-line)] bg-[var(--ui-surface)] p-4 text-xs leading-6 text-[var(--ui-text)] shadow-lg">
            <div className="flex justify-between"><strong>Modelagem do banco</strong><button type="button" onClick={() => setShowHelp(false)}>Fechar</button></div>
        <p>Use a paleta no cabeçalho para alterar cores. Clique no nome do grupo para recolher ou expandir. Clique nos tipos sublinhados e nos ícones de nota para consultar detalhes. Os mesmos controles estão disponíveis por teclado em Estrutura.</p>
        <p>Arraste tabelas e notas. Use o modo mão para mover o canvas. Ctrl/⌘ + rolagem controla o zoom. Organizar distribui as tabelas; Ajustar enquadra o conteúdo.</p>
        <p>Desfaça e refaça alterações pelos botões do editor ou Ctrl/⌘ Z e Ctrl/⌘ Shift Z no editor. PNG exporta a área visível; DBML exporta o código completo.</p>
        <pre className="overflow-auto rounded-lg bg-[var(--ui-raised)] p-2">{`Enum status {
  ativo
  inativo
}

TableGroup vendas {
  usuarios
  pedidos
  Note: 'Tabelas do módulo'
}

Note lembrete {
  'Revise os relacionamentos'
}`}</pre>
      </section>}
      {showDetails && <section aria-label="Estrutura do banco" className="absolute right-4 top-16 z-40 max-h-[70%] w-72 max-w-[calc(100%-2rem)] overflow-auto rounded-xl border border-[var(--ui-line)] bg-[var(--ui-surface)] p-4 text-xs text-[var(--ui-text)]">
        <div className="mb-3 flex justify-between"><strong>Estrutura do banco</strong><button type="button" onClick={() => setShowDetails(false)}>Fechar</button></div>
        {groups.map((group) => <div key={group.name} className="mb-3 flex flex-wrap gap-2">
          <button type="button" aria-expanded={!state.collapsedGroups?.includes(group.name)} onClick={() => toggleGroup(group.name)}>{state.collapsedGroups?.includes(group.name) ? 'Expandir' : 'Recolher'} {group.name}</button>
          {openColor && <button type="button" className="toolbar-button px-2" onClick={() => openColor({ kind: 'TableGroup', name: group.name })}>Cor do grupo {group.name}</button>}
        </div>)}
        {tables.map((table) => <details key={table.id} className="mb-3">
          <summary className="cursor-pointer font-semibold">{table.name}</summary>
          {openColor && <button type="button" className="toolbar-button my-2 px-2 py-1" onClick={() => openColor({ kind: 'Table', name: table.name })}>Cor da tabela {table.name}</button>}
          {table.note && <p className="mt-2 whitespace-pre-wrap text-[var(--ui-muted)]">{table.note}</p>}
          <ul className="mt-2 space-y-2">{table.columns.map((column) => <li key={column.id}>{column.name} · {column.type}{column.note && <button type="button" className="ml-2 underline" onClick={() => inspect({ title: `${table.name}.${column.name}`, text: column.note })}>Ver nota de {column.name}</button>}</li>)}</ul>
        </details>)}
        {notes.map((note) => <div key={note.name} className="mb-3 flex flex-wrap gap-2"><button type="button" onClick={() => inspect({ title: note.name, text: note.text })}>{note.name}</button>{openColor && <button type="button" className="toolbar-button px-2" onClick={() => openColor({ kind: 'Note', name: note.name })}>Cor da nota {note.name}</button>}</div>)}
        <h3 className="mb-2 font-semibold">Enums ({enums.length})</h3>
        {enums.map((entry) => <details key={entry.name} className="mb-3"><summary className="cursor-pointer">{entry.name}</summary><p className="mt-1 text-[var(--ui-muted)]">{entry.values.join(' · ')}</p></details>)}
      </section>}
      <DatabaseInspector target={colorTarget} inspection={inspection} onClose={() => { setColorTarget(null); setInspection(null); }} onColor={(color) => {
        if (colorTarget && onContentChange) onContentChange(setDbmlColor(content, colorTarget, color));
      }} />
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        draggable={interactionMode === "pan"}
        onDragEnd={handleStageDragEnd}
        onWheel={handleWheel}
        onClick={(event) => {
          if (event.target === event.target.getStage()) {
            setColorTarget(null);
            setInspection(null);
            setActiveEditor(null);
            setSelectedTableId(null);
            setSelectedRelationId(null);
            setEditingRelationId(null);
          }
        }}
      >
        <Layer>
          <DatabaseAnnotations groups={groups} notes={notes} tables={tables} state={state} onStateChange={onStateChange} positions={visualPositions} foreground={headerText} onOpenColor={openColor} onToggleGroup={toggleGroup} />
        </Layer>
        <Layer>
          <DatabaseRelations
            relations={visibleRelations}
            tableLookup={tableLookup}
            visualPositions={visualPositions}
            visualRelationPaths={visualRelationPaths}
            selectedRelationId={selectedRelationId}
            activeRelationIds={activeRelationIds}
            editingRelationId={editingRelationId}
            edgeStyle={edgeStyle}
            routingObstacles={routingObstacles.filter((obstacle) => !hiddenTables.has(obstacle.id))}
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
            tables={visibleTables}
            enums={enums}
            onOpenColor={openColor}
            onInspect={inspect}
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

      {tables.length === 0 && notes.length === 0 ? (
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
          className="absolute right-4 top-4 z-50 w-[min(28rem,calc(100%-2rem))] overflow-hidden rounded-2xl border shadow-[var(--ui-shadow-strong)] backdrop-blur-2xl border-[var(--ui-glass-border)] bg-[var(--ui-surface)] text-[var(--ui-heading)]"
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
        </div>
      </div>
    </div>
  );
}
