'use client';

import { getDisplayTitle } from "../lib/items";
import { type RefObject } from "react";
import type { MarkdownItem } from "../types/markdown";
import type { AppTheme } from "../lib/preferences";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

interface CombinedOutputPanelProps {
  items: MarkdownItem[];
  isLoading: boolean;
  theme: AppTheme;
  activeItemId?: string | null;
  scrollContainerRef?: RefObject<HTMLDivElement>;
}

export function CombinedOutputPanel({
  items,
  isLoading,
  theme,
  activeItemId,
  scrollContainerRef,
}: CombinedOutputPanelProps) {
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
          Preview renderizado
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
