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
      className="flex h-full min-h-0 flex-col gap-2 overflow-hidden rounded border p-3 border-[var(--ui-line)] bg-[var(--ui-surface)]"
    >
      <div>
        <p className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.28em] text-[var(--ui-accent)]">
          Coluna esquerda
        </p>
        <h2
          className="m-0 text-base font-semibold leading-tight text-[var(--ui-heading)]"
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

      <div className="app-scrollbar -mx-1 flex-1 overflow-y-auto pr-1">
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
                  className={`flex flex-col gap-1.5 rounded border px-2 py-1.5 text-[12px] transition ${
                    isHidden
                      ? "border-[var(--ui-line)] bg-[var(--ui-raised)] opacity-60"
                      : isActive
                      ? "border-[var(--ui-accent)] bg-[var(--ui-accent-soft)]"
                      : "border-[var(--ui-line)] bg-[var(--ui-surface)] hover:border-[var(--ui-line)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!isHidden}
                      onChange={() => onToggleItemVisibility(item.id)}
                      aria-label={`${isHidden ? "Exibir" : "Ocultar"} card ${displayTitle} no diagrama`}
                      className="h-3.5 w-3.5 accent-[var(--ui-accent)]"
                    />
                    <button
                      type="button"
                      onClick={() => onSelectItem(item)}
                      className="flex flex-1 items-center gap-2 text-left text-[var(--ui-text)]"
                    >
                      <span
                        className="inline-flex h-5 min-w-[1.5rem] items-center justify-center rounded px-1 text-[10px] font-semibold bg-[var(--ui-raised)] text-[var(--ui-muted)]"
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
                      className="flex-1 rounded border px-1 py-0.5 text-[11px] outline-none border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-text)]"
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
                      className="w-full resize-none rounded border px-2 py-1 text-[11px] outline-none border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-text)] placeholder:text-[var(--ui-muted)]"
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
