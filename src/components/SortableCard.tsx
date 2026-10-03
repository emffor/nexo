'use client';

import Image from "next/image";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getDisplayTitle } from "../lib/items";
import type { AppTheme } from "../lib/preferences";
import type { DiagramStatus, MarkdownItem } from "../types/markdown";
import { StatusDot } from "./StatusDot";
import { StatusPicker } from "./StatusPicker";

interface SortableCardProps {
  item: MarkdownItem;
  position: number;
  isOutlineMode?: boolean;
  isActive?: boolean;
  theme?: AppTheme;
  onSelect: (item: MarkdownItem) => void;
  onEdit: (item: MarkdownItem) => void;
  onDelete: (item: MarkdownItem) => void;
  onChangeStatus?: (itemId: string, status: DiagramStatus | undefined) => void;
}

export function SortableCard({
  item,
  position,
  isOutlineMode = false,
  isActive = false,
  theme = "dark",
  onSelect,
  onEdit,
  onDelete,
  onChangeStatus,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging
      ? {
          zIndex: 50,
          opacity: 0.9,
          boxShadow: "var(--ui-shadow-strong)",
        }
      : {}),
  };
  const displayTitle = getDisplayTitle(item, 56);

  const outlineContainerClass =
    isActive
        ? "border-[var(--ui-accent)] bg-[var(--ui-accent-soft)]"
        : "border-[var(--ui-line)] bg-[var(--ui-surface)]";

  const outlineButtonClass =
    isActive
        ? "border-[var(--ui-accent)] bg-[var(--ui-accent-soft)] text-[var(--ui-accent)]"
        : "border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-muted)] hover:border-[var(--ui-line)] hover:text-[var(--ui-heading)]";

  return (
    <article
      ref={setNodeRef}
      style={style}
      data-active={isActive}
      data-dragging={isDragging}
      className={`relative transition-all duration-150 ${
        isOutlineMode
          ? `nexo-outline-card rounded p-0.5 ${outlineContainerClass}`
          : `nexo-item-card rounded border px-3 py-2 ${
              isDragging
                ? "border-[var(--ui-line)] bg-[var(--ui-raised)]"
                : isActive
                  ? "border-[var(--ui-accent)] bg-[var(--ui-accent-soft)]"
                  : "border-[var(--ui-line)] bg-[var(--ui-surface)] hover:border-[var(--ui-line)]"
            }`
      }`}
    >
      <div className={`flex items-center ${isOutlineMode ? "gap-1" : "gap-2"}`}>
        {isOutlineMode ? null : (
          <span
            className="nexo-item-number tabular-nums text-xs font-medium px-1.5 py-0.5 rounded bg-[var(--ui-raised)] text-[var(--ui-muted)]"
          >
            {String(position + 1).padStart(2, "0")}
          </span>
        )}
        {isOutlineMode ? (
          <>
            <button
              type="button"
              onClick={() => onSelect(item)}
              title={getDisplayTitle(item, 56)}
              aria-label={`Ir para ${getDisplayTitle(item, 56)}`}
              className={`nexo-outline-button relative flex h-8 w-full cursor-grab items-center justify-center rounded border px-2 text-xs font-medium transition active:cursor-grabbing ${outlineButtonClass}`}
              {...attributes}
              {...listeners}
            >
              <span
                className="absolute left-1 top-1 tabular-nums text-[9px] text-[var(--ui-muted)]"
                aria-hidden="true"
              >
                {String(position + 1).padStart(2, "0")}
              </span>
              <span className="truncate">
                {item.title?.trim()
                  ? getDisplayTitle(item, 20)
                  : String(position + 1).padStart(2, "0")}
              </span>
            </button>
            {onChangeStatus ? (
              <StatusPicker
                status={item.status}
                theme={theme}
                label={displayTitle}
                buttonClassName="absolute right-1 top-1 h-4 w-4"
                dotClassName="h-1.5 w-1.5"
                onChangeStatus={(status) => onChangeStatus(item.id, status)}
              />
            ) : (
              <StatusDot
                status={item.status}
                theme={theme}
                className="absolute right-1 top-1 h-1.5 w-1.5"
              />
            )}
          </>
        ) : (
          <>
            {onChangeStatus ? (
              <StatusPicker
                status={item.status}
                theme={theme}
                label={displayTitle}
                onChangeStatus={(status) => onChangeStatus(item.id, status)}
              />
            ) : (
              <StatusDot status={item.status} theme={theme} />
            )}
            <button
              type="button"
              onClick={() => onSelect(item)}
              title={displayTitle}
              className="nexo-item-title min-w-0 flex-1 cursor-grab truncate text-left text-sm font-medium active:cursor-grabbing text-[var(--ui-heading)]"
              {...attributes}
              {...listeners}
            >
              <span className="truncate">{displayTitle}</span>
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onEdit(item)}
                aria-label={`Editar ${getDisplayTitle(item, 56)}`}
                className="nexo-card-action inline-flex h-6 w-6 items-center justify-center rounded border text-xs transition border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-muted)] hover:bg-[var(--ui-raised)] hover:text-[var(--ui-text)]"
                title="Editar card"
              >
                <Image src="/venture/edit.svg" width={16} height={16} alt="" className="nexo-nav-icon" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(item)}
                aria-label={`Remover ${getDisplayTitle(item, 56)}`}
                className="nexo-card-action nexo-card-action--danger inline-flex h-6 w-6 items-center justify-center rounded border text-xs transition border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-danger)] hover:border-[var(--ui-danger)] hover:bg-[var(--ui-danger-soft)] hover:text-[var(--ui-danger)]"
                title="Excluir card"
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
                  <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
