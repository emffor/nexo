"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { getDisplayTitle } from "../lib/items";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  type ReactNode,
} from "react";
import type { DiagramStatus, MarkdownItem } from "../types/markdown";
import type { AppTheme, ViewMode } from "../lib/preferences";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { DIAGRAM_STATUS_OPTIONS } from "../types/diagram";
import { StatusDot } from "./StatusDot";
import { StatusPicker } from "./StatusPicker";

const KANBAN_COLUMNS: { status: DiagramStatus | undefined; label: string; color: string }[] = [
  { status: undefined, label: "Sem status", color: "#64748b" },
  ...DIAGRAM_STATUS_OPTIONS.map((option) => ({
    status: option.value,
    label: option.label,
    color: {
      backlog: "#398acb",
      impedido: "#ce6675",
      "em-desenvolvimento": "#439b9c",
      revisando: "#8b78c5",
      finalizado: "#59a776",
    }[option.value],
  })),
];

function KanbanColumn({
  column, count, children,
}: {
  column: (typeof KANBAN_COLUMNS)[number];
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `kanban-column-${column.status ?? "none"}`,
    data: { status: column.status, isColumn: true },
  });

  return (
    <section
      ref={setNodeRef}
      aria-label={`${column.label}: ${count} cards`}
      className={`flex min-h-[420px] min-w-0 flex-col overflow-hidden rounded-xl border ${isOver ? "border-[var(--ui-accent)] ring-2 ring-[var(--ui-accent-soft)]" : "border-[var(--ui-line)]"}`}
      style={{ background: `color-mix(in srgb, ${column.color} 12%, var(--ui-surface))` }}
    >
      <header className="flex min-h-11 items-center justify-between gap-2 px-3 py-2.5 text-white" style={{ backgroundColor: column.color }}>
        <h3 className="m-0 text-xs font-semibold">{column.label}</h3>
        <span className="rounded-md bg-black/15 px-1.5 py-0.5 text-[10px] tabular-nums">{count}</span>
      </header>
      <div className="app-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {children}
        {count === 0 ? <p className="m-0 rounded-lg border border-dashed border-[var(--ui-line)] px-3 py-6 text-center text-xs text-[var(--ui-muted)]">Arraste um card para cá</p> : null}
      </div>
    </section>
  );
}

interface PreviewGridCardProps {
  item: MarkdownItem;
  position: number;
  theme: AppTheme;
  isActive: boolean;
  onClick: (event: MouseEvent<HTMLElement>, item: MarkdownItem) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>, item: MarkdownItem) => void;
}

function PreviewGridCard({
  item,
  position,
  theme,
  isActive,
  onClick,
  onKeyDown,
}: PreviewGridCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { status: item.status },
  });
  const displayTitle = getDisplayTitle(item, 72);
  const {
    role: _role,
    tabIndex: _tabIndex,
    ...sortableAttributes
  } = attributes;
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...(isDragging
      ? {
          zIndex: 50,
          opacity: 0.35,
          boxShadow: "var(--ui-shadow-strong)",
        }
      : {}),
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      id={`preview-item-${item.id}`}
      data-preview-item-id={item.id}
      role="button"
      tabIndex={0}
      aria-label={`Selecionar card ${displayTitle}`}
      data-active={isActive}
      {...sortableAttributes}
      {...listeners}
      onClick={(event) => onClick(event, item)}
      onKeyDown={(event) => {
        listeners?.onKeyDown?.(event);
        if (!event.defaultPrevented) {
          onKeyDown(event, item);
        }
      }}
      className={`nexo-kanban-card group flex shrink-0 min-h-[160px] scroll-mt-6 cursor-grab active:cursor-grabbing select-none flex-col overflow-hidden rounded-lg border text-left transition-all duration-200 ${
        isActive ? "preview-item-active" : ""
      } ${
        isDragging
          ? "border-[var(--ui-accent)] bg-[var(--ui-accent-soft)]"
          : isActive
              ? "border-[var(--ui-accent)] bg-[var(--ui-accent-soft)] shadow-[var(--ui-shadow)]"
              : "border-[var(--ui-line)] bg-[var(--ui-surface)] shadow-sm hover:border-[var(--ui-line)]"
      }`}
    >
      <div
        className="border-b px-3 py-2.5 border-[var(--ui-line)] bg-[var(--ui-surface)]"
      >
        <div className="flex items-center justify-between gap-3">
          <span
            className="nexo-preview-number rounded-full px-2 py-0.5 tabular-nums text-[10px] font-semibold uppercase tracking-[0.16em] bg-[var(--ui-tag-bg)] text-[var(--ui-tag)]"
          >
            {String(position + 1).padStart(2, "0")}
          </span>
          <div className="flex items-center gap-2">
            <StatusDot status={item.status} theme={theme} className="h-2 w-2" />
            <span
              aria-hidden="true"
              className="select-none px-1 text-xs text-[var(--ui-muted)] opacity-60 transition-opacity group-hover:opacity-100"
            >
              ⠿
            </span>
          </div>
        </div>
        <h3
          className="m-0 mt-2 line-clamp-1 text-[13px] font-semibold leading-5 text-[var(--ui-heading)]"
        >
          {displayTitle}
        </h3>
      </div>

      <div className="relative flex-1 px-3 py-2.5">
        <div className="markdown-preview markdown-preview--card max-h-[88px] overflow-hidden pointer-events-none select-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
          >
            {item.content}
          </ReactMarkdown>
        </div>
        <div
          className="nexo-preview-fade pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[var(--ui-surface)] to-transparent"
        />
      </div>

      <div
        className="mt-auto border-t px-3 py-2 border-[var(--ui-line)] text-[var(--ui-muted)]"
      >
        <p className="m-0 min-w-0 truncate text-[10px]">
          Atualizado em{" "}
          {new Intl.DateTimeFormat("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }).format(new Date(item.updatedAt))}
          {" · "}
          {item.content.length} chars
        </p>
      </div>
    </article>
  );
}

interface PreviewMarkdownSectionProps {
  item: MarkdownItem;
  position: number;
  theme: AppTheme;
  isActive?: boolean;
  withDivider?: boolean;
  onChangeStatus?: (itemId: string, status: DiagramStatus | undefined) => void;
}

function PreviewMarkdownSection({
  item,
  position,
  theme,
  isActive = false,
  withDivider = false,
  onChangeStatus,
}: PreviewMarkdownSectionProps) {
  return (
    <section
      id={`preview-item-${item.id}`}
      data-preview-item-id={item.id}
      className={`scroll-mt-6 ${withDivider ? "preview-item-divider mt-12 pt-12" : ""} ${isActive ? "preview-item-active" : ""}`}
    >
      <div className="mb-4 flex items-center gap-3">
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] bg-[var(--ui-raised)] text-[var(--ui-muted)]"
        >
          {String(position + 1).padStart(2, "0")}
        </span>
        {onChangeStatus ? (
          <StatusPicker
            status={item.status}
            theme={theme}
            label={getDisplayTitle(item, 72)}
            onChangeStatus={(status) => onChangeStatus(item.id, status)}
          />
        ) : (
          <StatusDot status={item.status} theme={theme} />
        )}
        <p
          className="m-0 text-xs font-medium uppercase tracking-[0.22em] text-[var(--ui-muted)]"
        >
          {getDisplayTitle(item, 72)}
        </p>
      </div>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {item.content}
      </ReactMarkdown>
    </section>
  );
}

interface CombinedOutputPanelProps {
  items: MarkdownItem[];
  isLoading: boolean;
  theme: AppTheme;
  viewMode: ViewMode;
  activeItemId?: string | null;
  scrollContainerRef?: RefObject<HTMLDivElement>;
  onSelect: (item: MarkdownItem) => void;
  onReorder: (activeId: string, overId: string) => Promise<void>;
  onChangeStatus?: (itemId: string, status: DiagramStatus | undefined) => void;
}

export function CombinedOutputPanel({
  items,
  isLoading,
  theme,
  viewMode,
  activeItemId,
  scrollContainerRef,
  onSelect,
  onReorder,
  onChangeStatus,
}: CombinedOutputPanelProps) {
  const [selectedPreviewCardId, setSelectedPreviewCardId] = useState<
    string | null
  >(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const draggedItem = items.find((item) => item.id === draggedItemId);
  const isCardsMode = viewMode === "cards";
  const isNormalMode = viewMode === "normal" || viewMode === "index";
  const selectedPreviewItem =
    isCardsMode && selectedPreviewCardId
      ? items.find((item) => item.id === selectedPreviewCardId)
      : null;
  const activeNormalItem = isNormalMode
    ? (items.find((item) => item.id === activeItemId) ?? items[0] ?? null)
    : null;
  const activeNormalPosition = activeNormalItem
    ? items.findIndex((item) => item.id === activeNormalItem.id)
    : 0;

  useEffect(() => {
    if (!isCardsMode) {
      setSelectedPreviewCardId(null);
      return;
    }

    if (
      selectedPreviewCardId &&
      !items.some((item) => item.id === selectedPreviewCardId)
    ) {
      setSelectedPreviewCardId(null);
    }
  }, [isCardsMode, items, selectedPreviewCardId]);

  const internalScrollRef = useRef<HTMLDivElement>(null);
  const containerRef = scrollContainerRef ?? internalScrollRef;

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
    try {
      if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    } catch {
      // Ignora ambientes sem suporte a scrollTo (ex: jsdom)
    }
    if (typeof document !== "undefined") {
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
  }, [activeItemId, selectedPreviewCardId, containerRef]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const dragHappenedRef = useRef(false);
  const dragResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (dragResetTimeoutRef.current) {
        clearTimeout(dragResetTimeoutRef.current);
      }
    };
  }, []);

  const handleOpenPreviewCard = (item: MarkdownItem) => {
    setSelectedPreviewCardId(item.id);
    onSelect(item);
  };

  const handlePreviewCardClick = (
    _event: MouseEvent<HTMLElement>,
    item: MarkdownItem,
  ) => {
    if (dragHappenedRef.current || draggedItemId) {
      return;
    }
    handleOpenPreviewCard(item);
  };

  const handlePreviewCardDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItemId(null);
    dragResetTimeoutRef.current = setTimeout(() => {
      dragHappenedRef.current = false;
    }, 120);

    if (!over || active.id === over.id) {
      return;
    }

    const source = items.find((item) => item.id === String(active.id));
    const target = items.find((item) => item.id === String(over.id));
    const column = KANBAN_COLUMNS.find(
      (candidate) => `kanban-column-${candidate.status ?? "none"}` === over.id,
    );
    if (!source || (!target && !column)) return;

    const targetStatus = column ? column.status : target?.status;
    if (source.status !== targetStatus) {
      onChangeStatus?.(source.id, targetStatus);
      return;
    }
    if (target) await onReorder(source.id, target.id);
  };

  const handleCardKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    item: MarkdownItem,
  ) => {
    if (event.target !== event.currentTarget) return;

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleOpenPreviewCard(item);
  };

  return (
    <section
      className="flex min-h-[420px] min-w-0 flex-col lg:min-h-0 text-[var(--ui-heading)]"
    >
      <div
        className="nexo-panel-heading flex items-center justify-between border-[var(--ui-line)]"
      >
        <h2
          className="m-0 text-xs font-semibold uppercase tracking-wider text-[var(--ui-heading)]"
        >
          {isCardsMode && !selectedPreviewItem
            ? "Quadro de cards"
            : "Preview Markdown"}
        </h2>
          <div className="flex flex-wrap items-center gap-2">
          {selectedPreviewItem ? (
            <button
              type="button"
              onClick={() => setSelectedPreviewCardId(null)}
              className="toolbar-button h-7 px-3 text-xs rounded-xl"
            >
              Voltar aos cards
            </button>
          ) : null}
        </div>
      </div>

      <div
        ref={containerRef}
        className={`app-scrollbar flex-1 overflow-y-auto pb-28 ${isCardsMode && !selectedPreviewItem ? "" : "nexo-surface rounded-2xl p-5 border border-[var(--ui-line)] bg-[var(--ui-surface)] shadow-sm"}`}
      >
        {isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
            <div
              className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--ui-line)] border-t-[var(--ui-accent)]"
            />
            <p
              className="m-0 text-sm text-[var(--ui-muted)]"
            >
              Carregando conteudo...
            </p>
          </div>
        ) : selectedPreviewItem ? (
          <article
            className="markdown-preview w-full border-0 px-0 py-2 sm:px-3 sm:py-3 bg-transparent"
          >
            <section
              id={`preview-item-${selectedPreviewItem.id}`}
              data-preview-item-id={selectedPreviewItem.id}
              className="scroll-mt-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] bg-[var(--ui-raised)] text-[var(--ui-muted)]"
                >
                  {String(
                    items.findIndex(
                      (item) => item.id === selectedPreviewItem.id,
                    ) + 1,
                  ).padStart(2, "0")}
                </span>
                {onChangeStatus ? (
                  <StatusPicker
                    status={selectedPreviewItem.status}
                    theme={theme}
                    label={getDisplayTitle(selectedPreviewItem, 72)}
                    onChangeStatus={(status) =>
                      onChangeStatus(selectedPreviewItem.id, status)
                    }
                  />
                ) : (
                  <StatusDot status={selectedPreviewItem.status} theme={theme} />
                )}
                <p
                  className="m-0 text-xs font-medium uppercase tracking-[0.22em] text-[var(--ui-muted)]"
                >
                  {getDisplayTitle(selectedPreviewItem, 72)}
                </p>
              </div>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw]}
              >
                {selectedPreviewItem.content}
              </ReactMarkdown>
            </section>
          </article>
        ) : isCardsMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={(args) => {
              const hits = pointerWithin(args);
              if (hits.length > 0) {
                const cardHits = hits.filter((hit) => !String(hit.id).startsWith("kanban-column-"));
                return cardHits.length > 0 ? cardHits : hits;
              }
              return args.pointerCoordinates ? [] : closestCorners(args);
            }}
            onDragStart={({ active }) => {
              dragHappenedRef.current = true;
              if (dragResetTimeoutRef.current) {
                clearTimeout(dragResetTimeoutRef.current);
                dragResetTimeoutRef.current = null;
              }
              setDraggedItemId(String(active.id));
            }}
            onDragCancel={() => {
              setDraggedItemId(null);
              dragResetTimeoutRef.current = setTimeout(() => {
                dragHappenedRef.current = false;
              }, 120);
            }}
            onDragEnd={handlePreviewCardDragEnd}
          >
            <div className="grid h-[calc(100dvh-240px)] min-h-[420px] grid-flow-col auto-cols-[minmax(250px,1fr)] gap-3 pb-3">
              {KANBAN_COLUMNS.map((column) => {
                const columnItems = items.filter((item) => item.status === column.status);
                return (
                  <KanbanColumn key={column.status ?? "none"} column={column} count={columnItems.length}>
                    <SortableContext items={columnItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                      {columnItems.map((item) => (
                        <PreviewGridCard
                          key={item.id}
                          item={item}
                          position={items.findIndex((candidate) => candidate.id === item.id)}
                          theme={theme}
                          isActive={item.id === activeItemId}
                          onClick={handlePreviewCardClick}
                          onKeyDown={handleCardKeyDown}
                        />
                      ))}
                    </SortableContext>
                  </KanbanColumn>
                );
              })}
            </div>
            <DragOverlay>
              {draggedItem ? (
                <div className="rounded-lg border border-[var(--ui-accent)] bg-[var(--ui-surface)] p-3 text-sm font-semibold text-[var(--ui-heading)] shadow-lg">
                  {getDisplayTitle(draggedItem, 72)}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : isNormalMode && activeNormalItem ? (
          <article
            className="markdown-preview w-full border-0 px-0 py-2 sm:px-2 sm:py-3 border-[var(--ui-line)] bg-[var(--ui-surface)] shadow-[var(--ui-shadow)]"
          >
            <PreviewMarkdownSection
              item={activeNormalItem}
              position={activeNormalPosition}
              theme={theme}
              onChangeStatus={onChangeStatus}
            />
          </article>
        ) : items.length > 0 ? (
          <article
            className="markdown-preview w-full border-0 px-0 py-2 sm:px-2 sm:py-3 border-[var(--ui-line)] bg-[var(--ui-surface)] shadow-[var(--ui-shadow)]"
          >
            {items.map((item, index) => (
              <PreviewMarkdownSection
                key={item.id}
                item={item}
                position={index}
                theme={theme}
                isActive={item.id === activeItemId}
                withDivider={index > 0}
                onChangeStatus={onChangeStatus}
              />
            ))}
          </article>
        ) : (
          <div
            className="nexo-empty flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed px-6 py-12 text-center border-[var(--ui-line)] bg-[var(--ui-surface)]"
          >
            <span
              className="text-5xl opacity-20"
              aria-hidden="true"
            >
              ❖
            </span>
            <div>
              <p
                className="m-0 text-sm font-semibold text-[var(--ui-text)]"
              >
                Preview vazio
              </p>
              <p
                className="m-0 mt-1 text-sm leading-6 text-[var(--ui-muted)]"
              >
                Adicione cards de markdown para visualizar o resultado final
                aqui.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
