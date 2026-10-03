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
      {isOutlineMode ? null : (
        <div className="nexo-panel-heading">
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--ui-muted)]">
              Cards
            </h2>
            <span className="tabular-nums text-xs text-[var(--ui-muted)]">
              ({items.length})
            </span>
          </div>
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
