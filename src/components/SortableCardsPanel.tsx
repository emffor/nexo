'use client';

import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { type RefObject } from "react";
import type { AppTheme } from "../lib/preferences";
import type { DiagramStatus, MarkdownItem } from "../types/markdown";
import { SortableCard } from "./SortableCard";

interface SortableCardsPanelProps {
  items: MarkdownItem[];
  isLoading: boolean;
  isOutlineMode?: boolean;
  activeItemId?: string | null;
  scrollContainerRef?: RefObject<HTMLDivElement>;
  theme?: AppTheme;
  onToggleOutlineMode?: () => void;
  onReorder: (activeId: string, overId: string) => Promise<void>;
  onSelect: (item: MarkdownItem) => void;
  onEdit: (item: MarkdownItem) => void;
  onDelete: (item: MarkdownItem) => void;
  onChangeStatus?: (itemId: string, status: DiagramStatus | undefined) => void;
}

export function SortableCardsPanel({
  items,
  isLoading,
  isOutlineMode = false,
  activeItemId,
  scrollContainerRef,
  theme = "dark",
  onToggleOutlineMode,
  onReorder,
  onSelect,
  onEdit,
  onDelete,
  onChangeStatus,
}: SortableCardsPanelProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    await onReorder(String(active.id), String(over.id));
  };

  return (
    <section
      className={`flex flex-col lg:min-h-0 ${
        isOutlineMode
          ? "nexo-surface rounded-2xl p-2.5 lg:sticky lg:top-3 lg:max-h-[calc(100vh-5rem)]"
          : `lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]`
      }`}
    >
      {isOutlineMode ? (
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--ui-muted)]">
            Índice
          </span>
          {onToggleOutlineMode ? (
            <button
              type="button"
              onClick={onToggleOutlineMode}
              className="toolbar-button h-6 w-6 p-0 text-xs rounded-lg inline-flex items-center justify-center text-[var(--ui-muted)] hover:text-[var(--ui-heading)]"
              title="Mudar para exibição completa"
              aria-label="Alternar para modo completo"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="nexo-panel-heading flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--ui-muted)]">
              Cards
            </h2>
            <span className="tabular-nums text-xs text-[var(--ui-muted)]">
              ({items.length})
            </span>
          </div>
          {onToggleOutlineMode ? (
            <button
              type="button"
              onClick={onToggleOutlineMode}
              className="toolbar-button h-6 px-2 text-[11px] rounded-lg gap-1.5 text-[var(--ui-muted)] hover:text-[var(--ui-heading)]"
              title="Mudar para índice compacto"
              aria-label="Alternar para modo índice"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="10" y1="6" x2="21" y2="6" />
                <line x1="10" y1="12" x2="21" y2="12" />
                <line x1="10" y1="18" x2="21" y2="18" />
                <path d="M4 6h1v4" />
                <path d="M4 10h2" />
                <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
              </svg>
              <span>Índice</span>
            </button>
          ) : null}
        </div>
      )}

      {isLoading ? (
        <div
          className="nexo-empty flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-10 border-[var(--ui-line)] bg-[var(--ui-surface)]"
        >
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--ui-line)] border-t-[var(--ui-accent)]"
          />
          <p
            className="m-0 text-sm text-[var(--ui-muted)]"
          >
            Carregando cards salvos...
          </p>
        </div>
      ) : null}

      {!isLoading && items.length === 0 ? (
        <div
          className="nexo-empty flex flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-6 py-12 text-center border-[var(--ui-line)] bg-[var(--ui-surface)]"
        >
          <span
            className="text-4xl text-[var(--ui-muted)]"
            aria-hidden="true"
          >
            +
          </span>
          <div>
            <p
              className="m-0 text-sm font-semibold text-[var(--ui-text)]"
            >
              Nenhum card ainda
            </p>
            <p
              className="m-0 mt-1 text-sm leading-6 text-[var(--ui-muted)]"
            >
              Clique em <strong>Novo markdown</strong> ou pressione{" "}
              <kbd
                className="rounded-md border px-1.5 py-0.5 tabular-nums text-xs border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-text)]"
              >
                Ctrl+N
              </kbd>{" "}
              para comecar.
            </p>
          </div>
        </div>
      ) : null}

      {!isLoading && items.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div
              ref={scrollContainerRef}
              className={`app-scrollbar flex lg:flex-1 ${
                isOutlineMode
                  ? "flex-col gap-1.5 overflow-y-auto pr-1"
                  : "nexo-surface rounded-2xl flex-col gap-1.5 overflow-y-auto p-2.5 shadow-sm"
              }`}
            >
              {items.map((item, index) => (
                <SortableCard
                  key={item.id}
                  item={item}
                  position={index}
                  isOutlineMode={isOutlineMode}
                  isActive={item.id === activeItemId}
                  theme={theme}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onChangeStatus={onChangeStatus}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : null}
    </section>
  );
}
