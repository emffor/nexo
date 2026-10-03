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
          boxShadow: "0 12px 28px rgba(0,0,0,0.25)",
        }
      : {}),
  };
  const displayTitle = getDisplayTitle(item, 56);

  const outlineContainerClass =
    theme === "dark"
      ? isActive
        ? "border-blue-500 bg-blue-950/20"
        : "border-zinc-800 bg-[#161b22]"
      : isActive
        ? "border-blue-500 bg-blue-50"
        : "border-zinc-200 bg-white";

  const outlineButtonClass =
    theme === "dark"
      ? isActive
        ? "border-blue-400 bg-blue-900/30 text-blue-200"
        : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
      : isActive
        ? "border-blue-400 bg-blue-100 text-blue-900"
        : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:text-zinc-900";

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
                ? theme === "dark"
                  ? "border-zinc-500 bg-zinc-800"
                  : "border-zinc-400 bg-zinc-100"
                : isActive
                  ? theme === "dark"
                    ? "border-blue-500/80 bg-blue-950/20"
                    : "border-blue-400 bg-blue-50/50"
                  : theme === "dark"
                    ? "border-zinc-800 bg-[#161b22] hover:border-zinc-700"
                    : "border-zinc-200 bg-white hover:border-zinc-300"
            }`
      }`}
    >
      <div className={`flex items-center ${isOutlineMode ? "gap-1" : "gap-2.5"}`}>
        {isOutlineMode ? null : (
          <span
            className={`nexo-item-number font-mono text-xs font-medium px-1.5 py-0.5 rounded ${
              theme === "dark"
                ? "bg-zinc-800 text-zinc-400"
                : "bg-zinc-100 text-zinc-600"
            }`}
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
                className={`absolute left-1 top-1 font-mono text-[9px] ${
                  theme === "dark"
                    ? "text-zinc-500"
                    : "text-zinc-400"
                }`}
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
              className={`nexo-item-title min-w-0 flex-1 cursor-grab truncate text-left text-sm font-medium active:cursor-grabbing ${
                theme === "dark" ? "text-zinc-200" : "text-zinc-900"
              }`}
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
                className={`nexo-card-action inline-flex h-6 w-6 items-center justify-center rounded border text-xs transition ${
                  theme === "dark"
                    ? "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                    : "border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                }`}
                title="Editar card"
              >
                <Image src="/venture/edit.svg" width={16} height={16} alt="" className="nexo-nav-icon" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(item)}
                aria-label={`Remover ${getDisplayTitle(item, 56)}`}
                className={`nexo-card-action nexo-card-action--danger inline-flex h-6 w-6 items-center justify-center rounded border text-xs transition ${
                  theme === "dark"
                    ? "border-zinc-700 bg-zinc-800 text-red-400 hover:border-red-900 hover:bg-red-950/40 hover:text-red-300"
                    : "border-zinc-200 bg-zinc-50 text-red-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                }`}
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
