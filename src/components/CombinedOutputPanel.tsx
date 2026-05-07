'use client';

import { getDisplayTitle } from "../lib/items";
import { useState, type KeyboardEvent, type RefObject } from "react";
import type { MarkdownItem } from "../types/markdown";
import type { AppTheme, ViewMode } from "../lib/preferences";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

interface CombinedOutputPanelProps {
  items: MarkdownItem[];
  isLoading: boolean;
  theme: AppTheme;
  viewMode: ViewMode;
  activeItemId?: string | null;
  scrollContainerRef?: RefObject<HTMLDivElement>;
  onSelect: (item: MarkdownItem) => void;
}

export function CombinedOutputPanel({
  items,
  isLoading,
  theme,
  viewMode,
  activeItemId,
  scrollContainerRef,
  onSelect,
}: CombinedOutputPanelProps) {
  const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(
    () => new Set(),
  );
  const isCardsMode = viewMode === "cards";

  const toggleExpandedCard = (itemId: string) => {
    setExpandedCardIds((current) => {
      const next = new Set(current);

      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }

      return next;
    });
  };

  const handleCardKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    item: MarkdownItem,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onSelect(item);
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
        <h2
          className={`m-0 text-[2.1rem] font-semibold tracking-[-0.03em] ${
            theme === "dark" ? "text-slate-50" : "text-slate-950"
          }`}
        >
          {isCardsMode ? "Preview em cards" : "Preview renderizado"}
        </h2>
      </div>

      <div
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto p-5 sm:p-7 ${theme === "dark" ? "bg-[#0b1118]" : "bg-slate-50/80"}`}
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
        ) : items.length > 0 && isCardsMode ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item, index) => {
              const isExpanded = expandedCardIds.has(item.id);
              const displayTitle = getDisplayTitle(item, 72);

              return (
                <article
                  key={item.id}
                  id={`preview-item-${item.id}`}
                  data-preview-item-id={item.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`Selecionar card ${displayTitle}`}
                  onClick={() => onSelect(item)}
                  onKeyDown={(event) => handleCardKeyDown(event, item)}
                  className={`group flex min-h-[320px] scroll-mt-6 flex-col overflow-hidden rounded-[1.1rem] border text-left transition ${
                    item.id === activeItemId ? "preview-item-active" : ""
                  } ${
                    theme === "dark"
                      ? item.id === activeItemId
                        ? "border-teal-400/55 bg-[#0f1b20] shadow-[0_0_0_1px_rgba(45,212,191,0.14)]"
                        : "border-slate-800/80 bg-[#0c1219] hover:border-slate-700"
                      : item.id === activeItemId
                        ? "border-teal-300 bg-teal-50/70 shadow-sm"
                        : "border-slate-200 bg-white shadow-sm hover:border-slate-300"
                  }`}
                >
                  <div
                    className={`border-b px-4 py-3 ${
                      theme === "dark"
                        ? "border-slate-800/80 bg-slate-950/20"
                        : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] ${
                          theme === "dark"
                            ? "bg-slate-800 text-slate-400"
                            : "bg-white text-slate-500"
                        }`}
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                          theme === "dark"
                            ? "bg-emerald-400/10 text-emerald-300"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            theme === "dark" ? "bg-emerald-300" : "bg-emerald-500"
                          }`}
                          aria-hidden="true"
                        />
                        {item.id === activeItemId ? "Selecionado" : "Card"}
                      </span>
                    </div>
                    <h3
                      className={`m-0 line-clamp-2 text-sm font-semibold leading-5 ${
                        theme === "dark" ? "text-slate-100" : "text-slate-950"
                      }`}
                    >
                      {displayTitle}
                    </h3>
                  </div>

                  <div className="relative flex-1 px-4 py-4">
                    <div
                      className={`markdown-preview markdown-preview--card ${
                        isExpanded ? "" : "max-h-[260px] overflow-hidden"
                      }`}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                      >
                        {item.content}
                      </ReactMarkdown>
                    </div>
                    {isExpanded ? null : (
                      <div
                        className={`pointer-events-none absolute inset-x-0 bottom-0 h-16 ${
                          theme === "dark"
                            ? "bg-gradient-to-t from-[#0c1219] to-transparent"
                            : "bg-gradient-to-t from-white to-transparent"
                        }`}
                      />
                    )}
                  </div>

                  <div
                    className={`mt-auto flex items-center justify-between gap-3 border-t px-4 py-3 ${
                      theme === "dark"
                        ? "border-slate-800/80 text-slate-500"
                        : "border-slate-200 text-slate-500"
                    }`}
                  >
                    <p className="m-0 min-w-0 truncate text-[11px]">
                      Atualizado em{" "}
                      {new Intl.DateTimeFormat("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      }).format(new Date(item.updatedAt))}
                      {" · "}
                      {item.content.length} chars
                    </p>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleExpandedCard(item.id);
                      }}
                      className={`shrink-0 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                        theme === "dark"
                          ? "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:bg-slate-800"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {isExpanded ? "Recolher" : "Mostrar completo"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
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
    </section>
  );
}
