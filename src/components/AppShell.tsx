"use client";

import { useState, type ReactNode } from "react";

import type { AppTheme, DiagramEdgeStyle, ViewMode } from "../lib/preferences";

interface AppShellProps {
  itemsCount: number;
  isCompactMode: boolean;
  isPreviewMaximized: boolean;
  isDiagramSidebarVisible: boolean;
  diagramEdgeStyle: DiagramEdgeStyle;
  databaseEdgeStyle: DiagramEdgeStyle;
  viewMode: ViewMode;
  databaseInfo?: {
    tables: number;
    relations: number;
    errors: number;
  };
  projectName?: string;
  storedDataSizeBytes: number;
  onBackToProjects?: () => void;
  onResetDatabaseLayout?: () => void;
  isScrollSyncEnabled: boolean;
  theme: AppTheme;
  fontScale: number;
  onOpenModal: () => void;
  onToggleCompactMode: () => void;
  onTogglePreviewMaximized: () => void;
  onToggleDiagramSidebar: () => void;
  onSetDiagramEdgeStyle: (style: DiagramEdgeStyle) => void;
  onSetDatabaseEdgeStyle: (style: DiagramEdgeStyle) => void;
  onSetViewMode: (mode: ViewMode) => void;
  onResetDiagramLayout?: () => void;
  onToggleScrollSync: () => void;
  onToggleTheme: () => void;
  onClearAll: () => void;
  onDecreaseFont: () => void;
  onIncreaseFont: () => void;
  onExport: () => void;
  onImport: () => void;
  onCopyAll: () => void;
  isMac?: boolean;
  leftPanel: ReactNode;
  rightPanel: ReactNode;
}

function ToolbarGroup({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`nexo-toolbar-group flex items-center gap-0.5 rounded-2xl border p-1 ${className}`}
    >
      {children}
    </div>
  );
}

const VIEW_MODE_OPTIONS: { mode: ViewMode; label: string; title: string }[] = [
  { mode: "normal", label: "Normal", title: "Editor + preview lado a lado" },
  {
    mode: "index",
    label: "\u00cdndice",
    title: "Lista compacta com \u00edndice",
  },
  { mode: "cards", label: "Cards", title: "Visualiza\u00e7\u00e3o em cards" },
  {
    mode: "diagram",
    label: "Diagrama",
    title: "Visualiza\u00e7\u00e3o em diagrama",
  },
  {
    mode: "database",
    label: "Banco",
    title: "Diagrama de banco (DBML)",
  },
];

const VIEW_MODE_ACCESSIBLE_LABELS: Record<ViewMode, string> = {
  normal: "Modo normal",
  index: "Modo indice",
  cards: "Modo cards",
  diagram: "Modo diagrama",
  database: "Modo banco",
};

function formatStorageSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${(bytes / 1024).toFixed(2)} KB`;
}

export function AppShell({
  itemsCount,
  isCompactMode,
  isPreviewMaximized,
  isDiagramSidebarVisible,
  diagramEdgeStyle,
  databaseEdgeStyle,
  viewMode,
  projectName,
  isScrollSyncEnabled,
  theme,
  fontScale,
  onOpenModal,
  onToggleCompactMode,
  onTogglePreviewMaximized,
  onToggleDiagramSidebar,
  onSetDiagramEdgeStyle,
  onSetDatabaseEdgeStyle,
  onSetViewMode,
  onResetDiagramLayout,
  onResetDatabaseLayout,
  databaseInfo,
  storedDataSizeBytes,
  onBackToProjects,
  onToggleScrollSync,
  onToggleTheme,
  onClearAll,
  onDecreaseFont,
  onIncreaseFont,
  onExport,
  onImport,
  onCopyAll,
  isMac = false,
  leftPanel,
  rightPanel,
}: AppShellProps) {
  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false);
  const isIndexMode = viewMode === "index";
  const isCardsMode = viewMode === "cards";
  const isDiagramMode = viewMode === "diagram";
  const isDatabaseMode = viewMode === "database";
  const isDiagramFullWidth = isDiagramMode && !isDiagramSidebarVisible;
  const isFullWidthMode = isCardsMode || isDiagramFullWidth;
  const isCanvasMode = isDiagramMode || isDatabaseMode;

  return (
    <main
      data-layout-mode={isCompactMode ? "compact" : "default"}
      data-theme={theme}
      className={`nexo-ui flex w-full flex-col ${
        isCanvasMode ? "h-screen min-h-0 overflow-hidden" : "min-h-screen"
      }`}
      style={{ ["--font-scale" as string]: String(fontScale) }}
    >
      <header className="nexo-topbar border-b px-5 sm:px-8 lg:px-10">
        <div className="flex min-h-[100px] flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {onBackToProjects ? (
              <button
                type="button"
                onClick={onBackToProjects}
                className="toolbar-button h-7 px-2 text-xs"
                title="Voltar para a lista de projetos"
              >
                ← Projetos
              </button>
            ) : null}

            <div className="flex min-w-0 flex-col items-start gap-1">
              <span className="text-xs font-medium text-[var(--ui-muted)]">
                Workspace /
              </span>
              <h1 className="m-0 truncate text-[28px] font-semibold tracking-tight">
                {projectName ?? "Jira Markdown"}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            <span className="toolbar-badge">
              {formatStorageSize(storedDataSizeBytes)}
            </span>
            <span className="toolbar-badge">
              {itemsCount} {itemsCount === 1 ? "card" : "cards"}
            </span>

            <button
              type="button"
              onClick={onCopyAll}
              className="toolbar-button h-7 px-2.5 text-xs"
              title={`Copiar todo o markdown combinado (${isMac ? "⌘" : "Ctrl"}+Shift+C)`}
            >
              Copiar tudo
            </button>

            <button
              type="button"
              onClick={onOpenModal}
              className="toolbar-button toolbar-button--accent h-7 px-3 text-xs"
              title={isMac ? "⌘N" : "Ctrl+N"}
            >
              + Novo card
            </button>

            <button
              type="button"
              onClick={() => setIsToolbarExpanded((current) => !current)}
              className="toolbar-button h-7 px-2 md:hidden"
              aria-label={isToolbarExpanded ? "Fechar opcoes" : "Mais opcoes"}
              aria-expanded={isToolbarExpanded}
            >
              {isToolbarExpanded ? "Fechar" : "Opções"}
            </button>
          </div>
        </div>

        <div
          className={`nexo-toolbar flex-wrap items-center gap-2 py-3 ${
            isToolbarExpanded ? "flex" : "hidden md:flex"
          }`}
        >
          <ToolbarGroup label="Modo de visualiza\u00e7\u00e3o" className="nexo-view-tabs">
            {VIEW_MODE_OPTIONS.map(({ mode, label, title }) => {
              const isActive = viewMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSetViewMode(mode)}
                  title={title}
                  aria-label={VIEW_MODE_ACCESSIBLE_LABELS[mode]}
                  aria-pressed={isActive}
                  className="font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {label}
                </button>
              );
            })}
          </ToolbarGroup>

          <ToolbarGroup label="Layout">
            <button
              type="button"
              onClick={onTogglePreviewMaximized}
              className={`toolbar-button border-transparent bg-transparent ${
                isPreviewMaximized ? "toolbar-button--primary" : ""
              }`}
              title="Alternar preview em tela cheia"
            >
              {isPreviewMaximized ? "Restaurar colunas" : "Maximizar preview"}
            </button>
            <button
              type="button"
              onClick={onToggleCompactMode}
              aria-label={
                isCompactMode ? "Restaurar espacamento" : "Usar tela inteira"
              }
              className={`toolbar-button border-transparent bg-transparent ${
                isCompactMode ? "toolbar-button--primary" : ""
              }`}
              title="Alternar espa\u00e7amento da p\u00e1gina"
            >
              {isCompactMode ? "Restaurar espa\u00e7amento" : "Tela inteira"}
            </button>
            <button
              type="button"
              onClick={onToggleScrollSync}
              disabled={isFullWidthMode || isDiagramMode || isDatabaseMode}
              className={`toolbar-button border-transparent bg-transparent ${
                isScrollSyncEnabled ? "toolbar-button--primary" : ""
              } disabled:cursor-not-allowed disabled:opacity-45`}
              title="Sincronizar rolagem entre editor e preview"
            >
              {isScrollSyncEnabled ? "Scroll sync ligado" : "Scroll sync"}
            </button>
            {isDiagramMode && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onSetDiagramEdgeStyle(
                      diagramEdgeStyle === "curve" ? "square" : "curve",
                    )
                  }
                  className="toolbar-button border-transparent bg-transparent"
                  title="Alternar estilo das linhas do diagrama"
                >
                  {diagramEdgeStyle === "curve"
                    ? "Linha curva"
                    : "Linha quadrada"}
                </button>
                <button
                  type="button"
                  onClick={onToggleDiagramSidebar}
                  aria-pressed={isDiagramSidebarVisible}
                  className={`toolbar-button border-transparent bg-transparent ${
                    isDiagramSidebarVisible ? "toolbar-button--primary" : ""
                  }`}
                  title="Alternar cards laterais do diagrama"
                >
                  {isDiagramSidebarVisible ? "Ocultar cards" : "Exibir cards"}
                </button>
                {onResetDiagramLayout && (
                  <button
                    type="button"
                    onClick={onResetDiagramLayout}
                    className="toolbar-button border-transparent bg-transparent"
                    title="Reorganizar layout do diagrama"
                  >
                    Resetar layout
                  </button>
                )}
              </>
            )}
            {isDatabaseMode && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    onSetDatabaseEdgeStyle(
                      databaseEdgeStyle === "curve" ? "square" : "curve",
                    )
                  }
                  className="toolbar-button border-transparent bg-transparent"
                  title="Alternar estilo das linhas do banco"
                >
                  {databaseEdgeStyle === "curve"
                    ? "Linha curva"
                    : "Linha quadrada"}
                </button>
                {onResetDatabaseLayout && (
                  <button
                    type="button"
                    onClick={onResetDatabaseLayout}
                    className="toolbar-button border-transparent bg-transparent"
                    title="Restaurar exemplo inicial do banco"
                  >
                    Resetar banco
                  </button>
                )}
              </>
            )}
          </ToolbarGroup>

          <ToolbarGroup label="Apar\u00eancia">
            <button
              type="button"
              onClick={onToggleTheme}
              className="toolbar-button border-transparent bg-transparent"
              title="Alternar tema"
            >
              {theme === "dark" ? "Modo claro" : "Modo escuro"}
            </button>
            <button
              type="button"
              onClick={onDecreaseFont}
              className="toolbar-button toolbar-button--icon border-transparent bg-transparent"
              title="Diminuir fonte"
              aria-label="A-"
            >
              A-
            </button>
            <button
              type="button"
              onClick={onIncreaseFont}
              className="toolbar-button toolbar-button--icon border-transparent bg-transparent"
              title="Aumentar fonte"
              aria-label="A+"
            >
              A+
            </button>
          </ToolbarGroup>

          <ToolbarGroup label="Dados">
            <button
              type="button"
              onClick={onImport}
              className="toolbar-button border-transparent bg-transparent"
              title="Importar arquivo .txt"
            >
              Importar
            </button>
            <button
              type="button"
              onClick={onExport}
              className="toolbar-button border-transparent bg-transparent"
              title="Exportar arquivo .txt"
            >
              Exportar
            </button>
          </ToolbarGroup>

          <button
            type="button"
            onClick={onClearAll}
            className="toolbar-button toolbar-button--danger md:ml-auto"
            title="Remover todos os cards"
          >
            Limpar tudo
          </button>
        </div>
      </header>

      <section
        className={`nexo-workspace grid flex-1 min-h-0 px-5 py-6 sm:px-8 lg:px-10 ${
          isDatabaseMode
            ? `lg:grid-cols-[minmax(280px,0.25fr)_minmax(0,0.75fr)] ${isCompactMode ? "gap-2" : "gap-4"}`
            : isPreviewMaximized
              ? "grid-cols-1"
              : isFullWidthMode
                ? "grid-cols-1"
                : isIndexMode
                  ? `lg:grid-cols-[140px_minmax(0,1fr)] ${isCompactMode ? "gap-3" : "gap-5"}`
                  : isDiagramMode
                    ? `lg:grid-cols-[minmax(240px,0.25fr)_minmax(0,0.75fr)] ${isCompactMode ? "gap-2" : "gap-4"}`
                    : `lg:grid-cols-[minmax(280px,0.33fr)_minmax(0,0.67fr)] ${isCompactMode ? "gap-2" : "gap-[30px]"}`
        }`}
      >
        {isDatabaseMode
          ? leftPanel
          : isPreviewMaximized || isFullWidthMode
            ? null
            : leftPanel}
        {rightPanel}
        {isDatabaseMode && databaseInfo ? (
          <p
            className={`col-span-full text-[10px] uppercase tracking-[0.18em] ${
              theme === "dark" ? "text-slate-400" : "text-slate-500"
            }`}
          >
            {databaseInfo.tables} tabela{databaseInfo.tables === 1 ? "" : "s"} ·{" "}
            {databaseInfo.relations} relação
            {databaseInfo.relations === 1 ? "" : "es"}
            {databaseInfo.errors > 0
              ? ` · ${databaseInfo.errors} erro${databaseInfo.errors === 1 ? "" : "s"} no DBML`
              : ""}
          </p>
        ) : null}
      </section>
    </main>
  );
}
