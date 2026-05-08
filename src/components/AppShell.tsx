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
  onSetViewMode: (mode: ViewMode) => void;
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
];

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
  onSetViewMode,
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
                  aria-pressed={isActive}
                  className={`rounded-md px-2 py-1 text-[11px] font-medium transition focus:outline-none focus:ring-2 focus:ring-teal-200 focus:ring-offset-1 focus:ring-offset-ink ${
                    isActive
                      ? "bg-teal-300/[0.14] text-teal-100 shadow-[inset_0_0_0_1px_rgba(94,234,212,0.25)]"
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
              disabled={isFullWidthMode || isDiagramMode}
              className={`toolbar-button border-transparent bg-transparent ${
                isScrollSyncEnabled ? "toolbar-button--primary" : ""
              } disabled:cursor-not-allowed disabled:opacity-45`}
              title="Sincronizar rolagem entre editor e preview"
            >
              {isScrollSyncEnabled ? "Scroll sync ligado" : "Scroll sync"}
            </button>
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
              aria-label="Diminuir fonte"
            >
              A-
            </button>
            <button
              type="button"
              onClick={onIncreaseFont}
              className="toolbar-button toolbar-button--icon border-transparent bg-transparent"
              title="Aumentar fonte"
              aria-label="Aumentar fonte"
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
