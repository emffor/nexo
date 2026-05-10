"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
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
} from "react";
import type { DiagramStatus, MarkdownItem } from "../types/markdown";
import type { AppTheme, ViewMode } from "../lib/preferences";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { StatusDot } from "./StatusDot";
import { StatusPicker } from "./StatusPicker";

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
          opacity: 0.92,
          boxShadow: "0 14px 34px rgba(0,0,0,0.28)",
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
      onClick={(event) => onClick(event, item)}
      onKeyDown={(event) => onKeyDown(event, item)}
      className={`group flex min-h-[236px] scroll-mt-6 cursor-grab flex-col overflow-hidden rounded-xl border text-left transition active:cursor-grabbing ${
        isActive ? "preview-item-active" : ""
      } ${
        isDragging
          ? theme === "dark"
            ? "border-teal-400/60 bg-[#0f1b20]"
            : "border-teal-300 bg-teal-50"
          : theme === "dark"
            ? isActive
              ? "border-teal-400/55 bg-[#0f1b20] shadow-[0_0_0_1px_rgba(45,212,191,0.14)]"
              : "border-slate-800/80 bg-[#0c1219] hover:border-slate-700"
            : isActive
              ? "border-teal-300 bg-teal-50/70 shadow-sm"
              : "border-slate-200 bg-white shadow-sm hover:border-slate-300"
      }`}
      {...sortableAttributes}
      {...listeners}
    >
      <div
        className={`border-b px-3 py-2.5 ${
          theme === "dark"
            ? "border-slate-800/80 bg-slate-950/20"
            : "border-slate-200 bg-slate-50"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] ${
              theme === "dark"
                ? "bg-slate-800 text-slate-400"
                : "bg-white text-slate-500"
            }`}
          >
            {String(position + 1).padStart(2, "0")}
          </span>
          <StatusDot status={item.status} theme={theme} className="h-2 w-2" />
        </div>
        <h3
          className={`m-0 mt-2 line-clamp-1 text-[13px] font-semibold leading-5 ${
            theme === "dark" ? "text-slate-100" : "text-slate-950"
          }`}
        >
          {displayTitle}
        </h3>
      </div>

      <div className="relative flex-1 px-3 py-3">
        <div className="markdown-preview markdown-preview--card max-h-[154px] overflow-hidden">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
          >
            {item.content}
          </ReactMarkdown>
        </div>
        <div
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-16 ${
            theme === "dark"
              ? "bg-gradient-to-t from-[#0c1219] to-transparent"
              : "bg-gradient-to-t from-white to-transparent"
          }`}
        />
      </div>

      <div
        className={`mt-auto border-t px-3 py-2 ${
          theme === "dark"
            ? "border-slate-800/80 text-slate-500"
            : "border-slate-200 text-slate-500"
        }`}
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

interface CombinedOutputPanelProps {
  items: MarkdownItem[];
  isLoading: boolean;
  theme: AppTheme;
  viewMode: ViewMode;
  activeItemId?: string | null;
  scrollContainerRef?: RefObject<HTMLDivElement>;
  onSelect: (item: MarkdownItem) => void;
  onReorder: (activeId: string, overId: string) => Promise<void>;
  onStrikeSelection: () => void;
  onUnstrikeSelection: () => void;
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
  onStrikeSelection,
  onUnstrikeSelection,
  onChangeStatus,
}: CombinedOutputPanelProps) {
  const [selectedPreviewCardId, setSelectedPreviewCardId] = useState<
    string | null
  >(null);
  const shouldIgnoreNextClickRef = useRef(false);
  const isCardsMode = viewMode === "cards";
  const selectedPreviewItem =
    isCardsMode && selectedPreviewCardId
      ? items.find((item) => item.id === selectedPreviewCardId)
      : null;

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

  const handleOpenPreviewCard = (item: MarkdownItem) => {
    setSelectedPreviewCardId(item.id);
    onSelect(item);
  };

  const handlePreviewCardClick = (
    event: MouseEvent<HTMLElement>,
    item: MarkdownItem,
  ) => {
    if (shouldIgnoreNextClickRef.current) {
      event.preventDefault();
      shouldIgnoreNextClickRef.current = false;
      return;
    }

    handleOpenPreviewCard(item);
  };

  const handlePreviewCardDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    shouldIgnoreNextClickRef.current = true;

    if (!over || active.id === over.id) {
      return;
    }

    await onReorder(String(active.id), String(over.id));
  };

  const handleCardKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    item: MarkdownItem,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleOpenPreviewCard(item);
  };

  return (
    <section
      className={`flex min-h-[420px] flex-col overflow-hidden rounded-[1.75rem] border lg:min-h-0 ${
        theme === "dark"
          ? "border-slate-800/70 bg-[#11161c]"
          : "border-slate-200 bg-white"
      }`}
    >
      <div
        className={`border-b px-5 py-5 sm:px-6 ${
          theme === "dark" ? "border-slate-800/70" : "border-slate-200"
        }`}
      >
        <p
          className={`mb-1 text-sm font-medium uppercase tracking-[0.24em] ${
            theme === "dark" ? "text-sky-300/85" : "text-sky-700/80"
          }`}
        >
          Coluna direita
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2
            className={`m-0 text-[2.1rem] font-semibold tracking-[-0.03em] ${
              theme === "dark" ? "text-slate-50" : "text-slate-950"
            }`}
          >
            {isCardsMode && !selectedPreviewItem
              ? "Preview em cards"
              : "Preview renderizado"}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {selectedPreviewItem ? (
              <button
                type="button"
                onClick={() => setSelectedPreviewCardId(null)}
                className={`inline-flex items-center justify-center self-start rounded-md border px-3 py-2 text-xs font-semibold transition sm:self-auto ${
                  theme === "dark"
                    ? "border-slate-700 bg-slate-900/70 text-slate-200 hover:border-slate-600 hover:bg-slate-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                Voltar aos cards
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className={`app-scrollbar flex-1 overflow-y-auto p-4 pb-28 sm:p-5 sm:pb-28 ${theme === "dark" ? "bg-[#0b1118]" : "bg-slate-50/80"}`}
      >
        {isLoading ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
            <div
              className={`h-5 w-5 animate-spin rounded-full border-2 ${theme === "dark" ? "border-slate-700 border-t-teal-400" : "border-slate-300 border-t-teal-500"}`}
            />
            <p
              className={`m-0 text-sm ${theme === "dark" ? "text-slate-400" : "text-slate-500"}`}
            >
              Carregando conteudo...
            </p>
          </div>
        ) : selectedPreviewItem ? (
          <article
            className={`markdown-preview w-full rounded-[1.35rem] border px-6 py-7 sm:px-8 sm:py-9 ${
              theme === "dark"
                ? "border-slate-800/65 bg-[#0c1219]"
                : "border-slate-200 bg-white shadow-sm"
            }`}
          >
            <section
              id={`preview-item-${selectedPreviewItem.id}`}
              data-preview-item-id={selectedPreviewItem.id}
              className="scroll-mt-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                    theme === "dark"
                      ? "bg-slate-800 text-slate-400"
                      : "bg-slate-100 text-slate-500"
                  }`}
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
                  className={`m-0 text-xs font-medium uppercase tracking-[0.22em] ${
                    theme === "dark" ? "text-slate-500" : "text-slate-400"
                  }`}
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
        ) : items.length > 0 && isCardsMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handlePreviewCardDragEnd}
          >
            <SortableContext
              items={items.map((item) => item.id)}
              strategy={rectSortingStrategy}
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {items.map((item, index) => (
                  <PreviewGridCard
                    key={item.id}
                    item={item}
                    position={index}
                    theme={theme}
                    isActive={item.id === activeItemId}
                    onClick={handlePreviewCardClick}
                    onKeyDown={handleCardKeyDown}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : items.length > 0 ? (
          <article
            className={`markdown-preview w-full rounded-[1.35rem] border px-6 py-7 sm:px-8 sm:py-9 ${
              theme === "dark"
                ? "border-slate-800/65 bg-[#0c1219]"
                : "border-slate-200 bg-white shadow-sm"
            }`}
          >
            {items.map((item, index) => (
              <section
                key={item.id}
                id={`preview-item-${item.id}`}
                data-preview-item-id={item.id}
                className={`scroll-mt-6 ${
                  index > 0 ? "preview-item-divider mt-12 pt-12" : ""
                } ${item.id === activeItemId ? "preview-item-active" : ""}`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${theme === "dark" ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {onChangeStatus ? (
                    <StatusPicker
                      status={item.status}
                      theme={theme}
                      label={getDisplayTitle(item, 72)}
                      onChangeStatus={(status) =>
                        onChangeStatus(item.id, status)
                      }
                    />
                  ) : (
                    <StatusDot status={item.status} theme={theme} />
                  )}
                  <p
                    className={`m-0 text-xs font-medium uppercase tracking-[0.22em] ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}
                  >
                    {getDisplayTitle(item, 72)}
                  </p>
                </div>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                >
                  {item.content}
                </ReactMarkdown>
              </section>
            ))}
          </article>
        ) : (
          <div
            className={`flex h-full min-h-[320px] w-full flex-col items-center justify-center gap-4 rounded-[1.35rem] border border-dashed px-6 py-12 text-center ${
              theme === "dark"
                ? "border-slate-700/80 bg-[#0c1219]"
                : "border-slate-300 bg-white"
            }`}
          >
            <span
              className={`text-5xl ${theme === "dark" ? "opacity-30" : "opacity-20"}`}
              aria-hidden="true"
            >
              ❖
            </span>
            <div>
              <p
                className={`m-0 text-sm font-semibold ${theme === "dark" ? "text-slate-300" : "text-slate-700"}`}
              >
                Preview vazio
              </p>
              <p
                className={`m-0 mt-1 text-sm leading-6 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}
              >
                Adicione cards de markdown para visualizar o resultado final
                aqui.
              </p>
            </div>
          </div>
        )}
      </div>

      {!isLoading && items.length > 0 ? (
        <div
          className={`fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2 rounded-xl border p-2 shadow-2xl backdrop-blur ${
            theme === "dark"
              ? "border-slate-700/80 bg-slate-950/80"
              : "border-slate-200/90 bg-white/90"
          }`}
        >
          <button
            type="button"
            title="Riscar seleção"
            aria-label="Riscar seleção"
            onPointerDown={(event) => event.preventDefault()}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onStrikeSelection}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-md border text-base font-bold transition ${
              theme === "dark"
                ? "border-slate-700 bg-slate-900/80 text-slate-200 hover:border-teal-400/70 hover:bg-slate-800 hover:text-teal-100"
                : "border-slate-200 bg-white text-slate-700 hover:border-teal-400 hover:bg-teal-50 hover:text-teal-800"
            }`}
          >
            <span className="line-through decoration-2" aria-hidden="true">
              S
            </span>
          </button>
          <button
            type="button"
            title="Desriscar seleção"
            aria-label="Desriscar seleção"
            onPointerDown={(event) => event.preventDefault()}
            onMouseDown={(event) => event.preventDefault()}
            onClick={onUnstrikeSelection}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-md border text-base font-bold transition ${
              theme === "dark"
                ? "border-slate-700 bg-slate-900/80 text-slate-200 hover:border-rose-400/70 hover:bg-slate-800 hover:text-rose-100"
                : "border-slate-200 bg-white text-slate-700 hover:border-rose-400 hover:bg-rose-50 hover:text-rose-800"
            }`}
          >
            <span aria-hidden="true">S</span>
          </button>
        </div>
      ) : null}
    </section>
  );
}
