"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";

import type { AppTheme, DiagramEdgeStyle, ViewMode } from "../lib/preferences";

interface AppShellProps {
  itemsCount: number;
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
  isSidebarToggleVisible?: boolean;
  isSidebarHidden?: boolean;
  isStrikethroughVisible?: boolean;
  onToggleStrikethrough?: () => void;
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
      className={`nexo-toolbar-group flex items-center gap-0.5 rounded-full border p-0.5 ${className}`}
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

const VIEW_MODE_ICONS: Record<ViewMode, string> = {
  normal: "notes",
  index: "clipboard",
  cards: "grid",
  diagram: "chart",
  database: "projects",
};

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
  isSidebarToggleVisible = false,
  isSidebarHidden = false,
  isStrikethroughVisible = false,
  onToggleStrikethrough,
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
      data-layout-mode="compact"
      data-theme={theme}
      suppressHydrationWarning
      data-view-mode={viewMode}
      className={`nexo-ui nexo-app-frame flex w-full flex-col ${
        isCanvasMode ? "h-screen min-h-0 overflow-hidden" : "min-h-screen"
      }`}
      style={{ ["--font-scale" as string]: String(fontScale) }}
    >
      <header className="nexo-topbar border-b px-5 sm:px-6">
        <div className="nexo-header-main flex min-h-[72px] flex-col gap-2 py-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {onBackToProjects ? (
              <button
                type="button"
                onClick={onBackToProjects}
                className="toolbar-button toolbar-button--back shrink-0 gap-2 h-8 px-3 text-xs rounded-full"
                title="Voltar para a lista de projetos"
              >
                <Image src="/venture/logogram.svg" width={20} height={20} alt="" className="nexo-brand-mark" />
                Projetos
              </button>
            ) : null}
            <div className="flex min-w-0 flex-col items-start gap-0.5">
              <span className="text-[11px] font-medium tracking-wide uppercase text-[var(--ui-muted)]">
                Workspace
              </span>
              <h1 className="m-0 truncate text-lg font-semibold tracking-tight text-[var(--ui-heading)]">
                {projectName ?? "Jira Markdown"}
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            <span className="toolbar-badge h-8 px-3 text-xs rounded-full">
              {formatStorageSize(storedDataSizeBytes)}
            </span>
            <span className="toolbar-badge h-8 px-3 text-xs rounded-full">
              {itemsCount} {itemsCount === 1 ? "card" : "cards"}
            </span>

            <button
              type="button"
              onClick={onCopyAll}
              disabled={itemsCount === 0}
              className="toolbar-button h-8 px-3.5 text-xs rounded-full"
              title={`Copiar todo o markdown combinado (${isMac ? "⌘" : "Ctrl"}+Shift+C)`}
            >
              Copiar tudo
            </button>

            <button
              type="button"
              onClick={onOpenModal}
              className="toolbar-button toolbar-button--accent h-8 px-4 text-xs rounded-full shadow-sm"
              title={isMac ? "⌘N" : "Ctrl+N"}
            >
              + Novo card
            </button>

            <button
              type="button"
              onClick={() => setIsToolbarExpanded((current) => !current)}
              className={`toolbar-button h-8 px-3.5 gap-2 text-xs rounded-full ${
                isToolbarExpanded ? "toolbar-button--active" : ""
              }`}
              aria-label="Ferramentas do workspace"
              aria-controls="workspace-tools"
              aria-expanded={isToolbarExpanded}
            >
              Ferramentas <span aria-hidden="true" className="text-xs">{isToolbarExpanded ? "−" : "+"}</span>
            </button>
          </div>
        </div>

        <nav aria-label="Visualizações do workspace" className="nexo-view-navigation">
          <ToolbarGroup label="Modo de visualização" className="nexo-view-tabs">
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
                  className="font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]"
                >
                  <Image
                    src={`/venture/${VIEW_MODE_ICONS[mode]}.svg`}
                    width={20}
                    height={20}
                    alt=""
                    className="nexo-nav-icon"
                  />
                  {label}
                </button>
              );
            })}
          </ToolbarGroup>
        </nav>

        <div
          id="workspace-tools"
          hidden={!isToolbarExpanded}
          className={`nexo-toolbar flex-wrap items-center gap-2.5 py-3 ${
            isToolbarExpanded ? "flex" : "hidden"
          }`}
        >
          <ToolbarGroup label="Layout">
            <button
              type="button"
              onClick={onToggleScrollSync}
              aria-pressed={isScrollSyncEnabled}
              disabled={isFullWidthMode || isDiagramMode || isDatabaseMode}
              className={`toolbar-button ${
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
                  className="toolbar-button"
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
                  className={`toolbar-button ${
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
                    className="toolbar-button"
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
                  className="toolbar-button"
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
                    className="toolbar-button"
                    title="Restaurar exemplo inicial do banco"
                  >
                    Resetar banco
                  </button>
                )}
              </>
            )}
          </ToolbarGroup>

          <ToolbarGroup label="Aparência">
            <button
              type="button"
              onClick={onToggleTheme}
              className="toolbar-button"
              title="Alternar tema"
            >
              {theme === "dark" ? "Modo claro" : "Modo escuro"}
            </button>
            <button
              type="button"
              onClick={onDecreaseFont}
              className="toolbar-button toolbar-button--icon"
              title="Diminuir fonte"
              aria-label="A-"
            >
              A-
            </button>
            <button
              type="button"
              onClick={onIncreaseFont}
              className="toolbar-button toolbar-button--icon"
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
              className="toolbar-button"
              title="Importar arquivo .txt"
            >
              Importar
            </button>
            <button
              type="button"
              onClick={onExport}
              className="toolbar-button"
              title="Exportar arquivo .txt"
            >
              Exportar
            </button>
          </ToolbarGroup>

          <button
            type="button"
            onClick={onClearAll}
            disabled={itemsCount === 0}
            className="toolbar-button toolbar-button--danger h-8 px-4 text-xs rounded-full md:ml-auto"
            title="Remover todos os cards"
          >
            Limpar tudo
          </button>
        </div>
      </header>

      <section
        className={`nexo-workspace grid flex-1 min-h-0 px-5 py-6 sm:px-8 ${
          isDatabaseMode
            ? `lg:grid-cols-[minmax(280px,0.25fr)_minmax(0,0.75fr)] gap-2`
            : isPreviewMaximized
              ? "grid-cols-1"
              : isFullWidthMode
                ? "grid-cols-1"
                : isIndexMode
                  ? `lg:grid-cols-[140px_minmax(0,1fr)] gap-3`
                  : isDiagramMode
                    ? `lg:grid-cols-[minmax(240px,0.25fr)_minmax(0,0.75fr)] gap-2`
                    : `lg:grid-cols-[minmax(240px,0.25fr)_minmax(0,0.75fr)] gap-2`
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
            className="col-span-full text-[10px] uppercase tracking-[0.18em] text-[var(--ui-muted)]"
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

      {isSidebarToggleVisible || isStrikethroughVisible ? (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2 rounded-2xl border p-1.5 shadow-[var(--ui-shadow-strong)] backdrop-blur-xl border-[var(--ui-line)] bg-[var(--ui-glass)]"
        >
          {isSidebarToggleVisible ? (
            <button
              type="button"
              title={
                isSidebarHidden
                  ? "Exibir coluna de cards"
                  : "Ocultar coluna de cards"
              }
              aria-label={
                isSidebarHidden
                  ? "Exibir coluna de cards"
                  : "Ocultar coluna de cards"
              }
              aria-pressed={isSidebarHidden}
              onClick={onTogglePreviewMaximized}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-150 border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-text)] hover:border-[var(--ui-accent)] hover:bg-[var(--ui-accent-soft)] hover:text-[var(--ui-accent)] active:scale-95 shadow-sm"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <line x1="9.5" y1="4" x2="9.5" y2="20" />
                {isSidebarHidden ? (
                  <path d="M13.5 9.5l3 2.5-3 2.5" />
                ) : (
                  <path d="M16.5 9.5l-3 2.5 3 2.5" />
                )}
              </svg>
            </button>
          ) : null}
          {isStrikethroughVisible ? (
            <button
              type="button"
              title="Alternar risco da seleção"
              aria-label="Alternar risco da seleção"
              onPointerDown={(event) => event.preventDefault()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={onToggleStrikethrough}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border text-base font-bold transition-all duration-150 border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-text)] hover:border-[var(--ui-accent)] hover:bg-[var(--ui-accent-soft)] hover:text-[var(--ui-accent)] active:scale-95 shadow-sm"
            >
              <span className="line-through decoration-2" aria-hidden="true">
                S
              </span>
            </button>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
