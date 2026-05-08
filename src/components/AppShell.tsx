"use client";

import { useState, type ReactNode } from "react";

import type { AppTheme, ViewMode } from "../lib/preferences";

interface AppShellProps {
  itemsCount: number;
  isCompactMode: boolean;
  isPreviewMaximized: boolean;
  viewMode: ViewMode;
  isScrollSyncEnabled: boolean;
  theme: AppTheme;
  fontScale: number;
  onOpenModal: () => void;
  onToggleCompactMode: () => void;
  onTogglePreviewMaximized: () => void;
  onCycleViewMode: () => void;
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

function ToolbarDivider() {
  return (
    <span
      className="mx-0.5 hidden h-4 w-px bg-white/10 sm:inline-block"
      aria-hidden="true"
    />
  );
}

export function AppShell({
  itemsCount,
  isCompactMode,
  isPreviewMaximized,
  viewMode,
  isScrollSyncEnabled,
  theme,
  fontScale,
  onOpenModal,
  onToggleCompactMode,
  onTogglePreviewMaximized,
  onCycleViewMode,
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
  const isFullWidthMode = isCardsMode;
  const viewModeLabel =
    viewMode === "normal"
      ? "Modo indice"
      : viewMode === "index"
        ? "Modo cards"
        : viewMode === "cards"
          ? "Modo diagrama"
          : "Modo normal";

  return (
    <main
      data-layout-mode={isCompactMode ? "compact" : "default"}
      data-theme={theme}
      className={`flex min-h-screen w-full flex-col ${
        isCompactMode ? "px-2 py-0 sm:px-3" : "px-4 py-6 sm:px-6 lg:px-8"
      }`}
      style={{ ["--font-scale" as string]: String(fontScale) }}
    >
      <header
        className={`flex flex-col gap-1.5 border-b border-white/10 bg-ink text-white ${
          isCompactMode
            ? "mb-2 rounded-none px-4 py-2 sm:px-5"
            : "mb-3 rounded-[1.25rem] px-5 py-3 sm:px-6"
        }`}
      >
        <div className="flex flex-col gap-1.5 md:flex-row md:items-center md:justify-between">
          <div className={`${isPreviewMaximized ? "max-w-2xl" : "max-w-3xl"}`}>
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.28em] text-teal-200/90">
              Organizar Markdown
            </p>
            <h1 className="m-0 text-[1.25rem] font-semibold leading-tight tracking-[-0.03em] text-slate-50 sm:text-[1.5rem] lg:text-[1.65rem]">
              Cole blocos em markdown, reordene os cards e gere a versao final.
            </h1>
          </div>

          <div className="flex items-center justify-start gap-1 sm:justify-end">
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
          className={`flex-wrap items-center gap-1 ${
            isToolbarExpanded ? "flex" : "hidden md:flex"
          }`}
        >
          <button
            type="button"
            onClick={onTogglePreviewMaximized}
            className="toolbar-button toolbar-button--primary"
          >
            {isPreviewMaximized ? "Restaurar colunas" : "Maximizar preview"}
          </button>
          <button
            type="button"
            onClick={onToggleCompactMode}
            className="toolbar-button"
          >
            {isCompactMode ? "Restaurar espacamento" : "Usar tela inteira"}
          </button>
          <button
            type="button"
            onClick={onCycleViewMode}
            className={`toolbar-button ${viewMode !== "normal" ? "toolbar-button--primary" : ""}`}
          >
            {viewModeLabel}
          </button>
          <button
            type="button"
            onClick={onToggleScrollSync}
            disabled={isFullWidthMode || isDiagramMode}
            className={`toolbar-button ${
              isScrollSyncEnabled ? "toolbar-button--primary" : ""
            } disabled:cursor-not-allowed disabled:opacity-45`}
          >
            {isScrollSyncEnabled ? "Scroll sync ligado" : "Scroll sync"}
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            className="toolbar-button"
          >
            {theme === "dark" ? "Modo claro" : "Modo escuro"}
          </button>

          <ToolbarDivider />

          <button
            type="button"
            onClick={onDecreaseFont}
            className="toolbar-button toolbar-button--icon"
            title="Diminuir fonte"
          >
            A-
          </button>
          <button
            type="button"
            onClick={onIncreaseFont}
            className="toolbar-button toolbar-button--icon"
            title="Aumentar fonte"
          >
            A+
          </button>

          <ToolbarDivider />

          <button type="button" onClick={onImport} className="toolbar-button">
            Importar .txt
          </button>
          <button type="button" onClick={onExport} className="toolbar-button">
            Exportar .txt
          </button>

          <ToolbarDivider />

          <button
            type="button"
            onClick={onClearAll}
            className="toolbar-button toolbar-button--danger"
          >
            Limpar tudo
          </button>
        </div>
      </header>

      <section
        className={`grid flex-1 ${
          isPreviewMaximized
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
        {isPreviewMaximized || isFullWidthMode ? null : leftPanel}
        {rightPanel}
      </section>
    </main>
  );
}
