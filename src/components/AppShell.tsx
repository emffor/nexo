"use client";

import { useState, type ReactNode } from "react";

import type { AppTheme, DiagramEdgeStyle, ViewMode } from "../lib/preferences";

interface AppShellProps {
  itemsCount: number;
  isCompactMode: boolean;
  isPreviewMaximized: boolean;
  isDiagramSidebarVisible: boolean;
  diagramEdgeStyle: DiagramEdgeStyle;
  viewMode: ViewMode;
  databaseInfo?: {
    tables: number;
    relations: number;
    errors: number;
  };
  onResetDatabaseLayout?: () => void;
  isScrollSyncEnabled: boolean;
  theme: AppTheme;
  fontScale: number;
  onOpenModal: () => void;
  onToggleCompactMode: () => void;
  onTogglePreviewMaximized: () => void;
  onToggleDiagramSidebar: () => void;
  onSetDiagramEdgeStyle: (style: DiagramEdgeStyle) => void;
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
      className={`flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5 ${className}`}
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

export function AppShell({
  itemsCount,
  isCompactMode,
  isPreviewMaximized,
  isDiagramSidebarVisible,
  diagramEdgeStyle,
  viewMode,
  isScrollSyncEnabled,
  theme,
  fontScale,
  onOpenModal,
  onToggleCompactMode,
  onTogglePreviewMaximized,
  onToggleDiagramSidebar,
  onSetDiagramEdgeStyle,
  onSetViewMode,
  onResetDiagramLayout,
  onResetDatabaseLayout,
  databaseInfo,
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
      className={`flex w-full flex-col ${
        isCanvasMode ? "h-screen min-h-0 overflow-hidden" : "min-h-screen"
      } ${isCompactMode ? "px-2 py-0 sm:px-3" : "px-4 py-6 sm:px-6 lg:px-8"}`}
      style={{ ["--font-scale" as string]: String(fontScale) }}
    >
      <header
        className={`flex flex-col gap-2 border-b shadow-[0_1px_0_rgba(255,255,255,0.04)] ${
          theme === "dark"
            ? "border-white/10 bg-ink text-white"
            : "border-slate-200 bg-white/90 text-slate-950 shadow-slate-200/80"
        } ${
          isCompactMode
            ? "mb-2 rounded-none px-4 py-2 sm:px-5"
            : "mb-3 rounded-[1.25rem] px-5 py-3.5 sm:px-6"
        }`}
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div
            className={`flex min-w-0 items-start gap-3 ${
              isPreviewMaximized ? "max-w-2xl" : "max-w-4xl"
            }`}
          >
            <div
              className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg border shadow-[inset_0_0_0_1px_rgba(94,234,212,0.08)] ${
                theme === "dark"
                  ? "border-teal-300/20 bg-teal-300/[0.12]"
                  : "border-teal-500/30 bg-teal-50"
              }`}
            >
              <span
                className={`font-mono text-[14px] font-semibold leading-none ${
                  theme === "dark" ? "text-teal-100" : "text-teal-700"
                }`}
              >
                MD
              </span>
            </div>
            <div className="min-w-0">
              <p
                className={`mb-1 text-[10px] font-medium uppercase tracking-[0.24em] ${
                  theme === "dark" ? "text-teal-200/80" : "text-sky-700"
                }`}
              >
                Organizador de conteudo
              </p>
              <h1
                className={`m-0 text-[1.5rem] font-semibold leading-tight ${
                  theme === "dark" ? "text-slate-50" : "text-slate-950"
                }`}
              >
                Jira Markdown
              </h1>
              <p
                className={`mt-1 max-w-2xl text-[13px] leading-snug ${
                  theme === "dark" ? "text-slate-300" : "text-sky-700"
                }`}
              >
                Cole blocos, organize cards e exporte a versao final.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-start gap-1 sm:justify-end">
            <button
              type="button"
              onClick={onCopyAll}
              className="toolbar-button"
              title={`Copiar todo o markdown combinado (${isMac ? "⌘" : "Ctrl"}+Shift+C)`}
            >
              Copiar tudo
            </button>
            <span className="toolbar-badge">
              {itemsCount} card{itemsCount === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              onClick={onOpenModal}
              className="toolbar-button toolbar-button--accent"
              title={isMac ? "⌘N" : "Ctrl+N"}
            >
              Novo markdown
            </button>
            <button
              type="button"
              onClick={() => setIsToolbarExpanded((current) => !current)}
              className="toolbar-button md:hidden"
              aria-label={isToolbarExpanded ? "Fechar opcoes" : "Mais opcoes"}
              aria-expanded={isToolbarExpanded}
            >
              {isToolbarExpanded ? "Fechar" : "Opcoes"}
            </button>
          </div>
        </div>

        <div
          className={`flex-wrap items-center gap-2 ${
            isToolbarExpanded ? "flex" : "hidden md:flex"
          }`}
        >
          <ToolbarGroup label="Modo de visualiza\u00e7\u00e3o">
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
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition focus:outline-none focus:ring-2 focus:ring-teal-200 focus:ring-offset-1 focus:ring-offset-ink ${
                    isActive
                      ? theme === "light"
                        ? "bg-teal-50 text-teal-700 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.3)]"
                        : "bg-teal-300/[0.14] text-teal-100 shadow-[inset_0_0_0_1px_rgba(94,234,212,0.25)]"
                      : theme === "light"
                        ? "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        : "text-slate-300 hover:bg-white/[0.05] hover:text-slate-100"
                  }`}
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
            {isDatabaseMode && onResetDatabaseLayout && (
              <button
                type="button"
                onClick={onResetDatabaseLayout}
                className="toolbar-button border-transparent bg-transparent"
                title="Reorganizar layout do diagrama de banco"
              >
                Resetar layout
              </button>
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
        className={`grid flex-1 min-h-0 ${
          isDatabaseMode
            ? `lg:grid-cols-[minmax(280px,0.25fr)_minmax(0,0.75fr)] ${isCompactMode ? "gap-2" : "gap-4"}`
            : isPreviewMaximized
              ? "grid-cols-1"
              : isFullWidthMode
                ? "grid-cols-1"
                : isIndexMode
                  ? `lg:grid-cols-[120px_minmax(0,1fr)] ${isCompactMode ? "gap-2" : "gap-4"}`
                  : isDiagramMode
                    ? `lg:grid-cols-[minmax(240px,0.25fr)_minmax(0,0.75fr)] ${isCompactMode ? "gap-2" : "gap-4"}`
                    : `lg:grid-cols-[minmax(280px,0.33fr)_minmax(0,0.67fr)] ${isCompactMode ? "gap-2" : "gap-6"}`
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
