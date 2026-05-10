'use client';

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
        ? "border-teal-400/60 bg-teal-400/10 shadow-[0_0_0_1px_rgba(45,212,191,0.12)]"
        : "border-slate-800/90 bg-[#111823]"
      : isActive
        ? "border-teal-500/60 bg-teal-50 shadow-[0_0_0_1px_rgba(13,148,136,0.08)]"
        : "border-slate-300 bg-white/95 shadow-sm";

  const outlineButtonClass =
    theme === "dark"
      ? isActive
        ? "border-teal-300/70 bg-teal-400/12 text-teal-200"
        : "border-slate-700/80 bg-slate-900/40 text-slate-400 hover:border-slate-600 hover:bg-slate-800/70 hover:text-slate-200"
      : isActive
        ? "border-teal-400/70 bg-teal-100 text-teal-800"
        : "border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900";

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`relative transition-all duration-200 ${
        isOutlineMode
          ? `rounded-lg p-0.5 ${outlineContainerClass}`
          : `rounded-[1.1rem] border px-4 py-3 ${
              isDragging
                ? theme === "dark"
                  ? "border-teal-400/50 bg-teal-400/10"
                  : "border-teal-300 bg-teal-50/40"
                : isActive
                  ? theme === "dark"
                    ? "border-teal-400/40 bg-teal-400/[0.06]"
                    : "border-teal-200 bg-teal-50/50"
                  : theme === "dark"
                    ? "border-slate-700/70 bg-[#141b24]"
                    : "border-slate-200/80 bg-white"
            }`
      }`}
    >
      <div className={`flex items-center ${isOutlineMode ? "gap-1" : "gap-3"}`}>
        {isOutlineMode ? null : (
          <span
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${theme === "dark" ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}
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
              className={`relative flex h-11 w-full cursor-grab items-center justify-center rounded-md border px-2 text-[11px] font-bold tracking-[0.18em] transition active:cursor-grabbing ${outlineButtonClass}`}
              {...attributes}
              {...listeners}
            >
              <span
                className={`absolute left-1.5 top-1.5 rounded-[0.25rem] px-1 font-mono text-[8px] font-semibold leading-3 tracking-[0.12em] ${
                  theme === "dark"
                    ? "bg-slate-800 text-slate-500"
                    : "bg-slate-100 text-slate-400"
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
                buttonClassName="absolute right-1 top-1 h-5 w-5"
                dotClassName="h-2 w-2"
                onChangeStatus={(status) => onChangeStatus(item.id, status)}
              />
            ) : (
              <StatusDot
                status={item.status}
                theme={theme}
                className="absolute right-1.5 top-1.5 h-2 w-2"
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
              className={`min-w-0 flex-1 cursor-grab truncate text-left text-[1.15rem] font-semibold leading-6 tracking-[-0.02em] active:cursor-grabbing ${theme === "dark" ? "text-slate-100" : "text-slate-950"}`}
              {...attributes}
              {...listeners}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate">{displayTitle}</span>
              </span>
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onEdit(item)}
                aria-label={`Editar ${getDisplayTitle(item, 56)}`}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${theme === "dark" ? "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:bg-slate-700 hover:text-slate-200" : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900"}`}
              >
                <span aria-hidden="true">✎</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(item)}
                aria-label={`Remover ${getDisplayTitle(item, 56)}`}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${theme === "dark" ? "border-slate-700 bg-slate-800 text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-300" : "border-slate-200 bg-slate-50 text-rose-400 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"}`}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
