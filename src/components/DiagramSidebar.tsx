"use client";

import type { AppTheme } from "../lib/preferences";
import { getDisplayTitle } from "../lib/items";
import {
  DIAGRAM_STATUS_OPTIONS,
  DIAGRAM_STATUS_PALETTE,
} from "../types/diagram";
import type { DiagramStatus, MarkdownItem } from "../types/markdown";

interface DiagramSidebarProps {
  items: MarkdownItem[];
  theme: AppTheme;
  activeItemId: string | null;
  hiddenItemIds: Set<string>;
  onSelectItem: (item: MarkdownItem) => void;
  onToggleItemVisibility: (itemId: string) => void;
  onChangeStatus: (itemId: string, status: DiagramStatus | undefined) => void;
  onChangeObservation: (itemId: string, observation: string) => void;
  onResetLayout: () => void;
  onClearEdges: () => void;
}

export function DiagramSidebar({
  items,
  theme,
  activeItemId,
  hiddenItemIds,
  onSelectItem,
  onToggleItemVisibility,
  onChangeObservation,
  onChangeStatus,
  onResetLayout,
  onClearEdges,
}: DiagramSidebarProps) {
  return (
    <aside
      className={`flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded-[1.25rem] border p-3 ${
        theme === "dark"
          ? "border-white/10 bg-ink/60"
          : "border-slate-200 bg-white"
      }`}
    >
      <div>
        <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.28em] text-teal-300/90">
          Coluna esquerda
        </p>
        <h2
          className={`m-0 text-base font-semibold leading-tight ${
            theme === "dark" ? "text-slate-50" : "text-slate-900"
          }`}
        >
          Cards no diagrama
        </h2>
      </div>

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={onResetLayout}
          className="toolbar-button toolbar-button--icon"
          title="Reorganizar nós em grade"
        >
          Resetar layout
        </button>
        <button
          type="button"
          onClick={onClearEdges}
          className="toolbar-button toolbar-button--icon"
          title="Remover todas as ligações"
        >
          Limpar setas
        </button>
      </div>

      <div className="-mx-1 flex-1 overflow-y-auto pr-1">
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {items.map((item, index) => {
            const status = item.status ?? "backlog";
            const palette = DIAGRAM_STATUS_PALETTE[status][theme];
            const isActive = item.id === activeItemId;
            const isHidden = hiddenItemIds.has(item.id);
            const displayTitle = getDisplayTitle(item, 60);
            return (
              <li key={item.id}>
                <div
                  className={`flex flex-col gap-1.5 rounded-md border px-2 py-1.5 text-[12px] transition ${
                    isHidden
                      ? theme === "dark"
                        ? "border-white/5 bg-white/[0.01] opacity-55"
                        : "border-slate-200 bg-slate-100 opacity-60"
                      : isActive
                      ? theme === "dark"
                        ? "border-teal-400/60 bg-teal-400/10"
                        : "border-teal-500 bg-teal-50"
                      : theme === "dark"
                        ? "border-white/5 bg-white/[0.02] hover:border-white/15"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => onToggleItemVisibility(item.id)}
                      aria-label={`${isHidden ? "Exibir" : "Ocultar"} card ${displayTitle} no diagrama`}
                      className="h-3.5 w-3.5 accent-teal-400"
                    />
                    <button
                      type="button"
                      onClick={() => onSelectItem(item)}
                      className={`flex flex-1 items-center gap-2 text-left ${
                        theme === "dark" ? "text-slate-100" : "text-slate-800"
                      }`}
                    >
                      <span
                        className={`inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded px-1 text-[10px] font-semibold ${
                        theme === "dark"
                          ? "bg-white/10 text-slate-300"
                          : "bg-slate-200 text-slate-600"
                        }`}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="flex-1 truncate">{displayTitle}</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full border"
                      style={{
                        backgroundColor: palette.fill,
                        borderColor: palette.border,
                      }}
                    />
                    <select
                      value={item.status ?? ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        onChangeStatus(
                          item.id,
                          value === "" ? undefined : (value as DiagramStatus),
                        );
                      }}
                      className={`flex-1 rounded border px-1 py-0.5 text-[11px] outline-none ${
                        theme === "dark"
                          ? "border-white/10 bg-ink/80 text-slate-200"
                          : "border-slate-300 bg-white text-slate-700"
                      }`}
                    >
                      <option value="">Sem status</option>
                      {DIAGRAM_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isActive && (
                    <textarea
                      value={item.observation ?? ""}
                      onChange={(event) => {
                        onChangeObservation(item.id, event.target.value);
                      }}
                      placeholder="Adicione uma observação..."
                      className={`w-full resize-none rounded border px-2 py-1 text-[11px] outline-none ${
                        theme === "dark"
                          ? "border-white/10 bg-ink/80 text-slate-200 placeholder:text-slate-500"
                          : "border-slate-300 bg-white text-slate-700 placeholder:text-slate-400"
                      }`}
                      rows={2}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
