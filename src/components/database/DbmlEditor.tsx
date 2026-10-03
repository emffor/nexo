"use client";

import { useId, useRef } from "react";
import type { AppTheme } from "../../lib/preferences";

interface DbmlEditorProps {
  value: string;
  theme: AppTheme;
  onChange: (next: string) => void;
  errors?: string[];
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  saveStatus?: "saved" | "saving" | "error";
}

function renderDbmlTokens(code: string) {
  // Regex para capturar comentários, strings, blocos de colchetes, keywords, tipos e símbolos
  const regex =
    /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|'''[\s\S]*?'''|'[^']*'|"[^"]*"|\[[^\]]*\]|\b(?:TableGroup|Table|Enum|Ref|Note|Records|Project)\b|\b(?:int|integer|bigint|smallint|tinyint|varchar|char|text|decimal|numeric|float|double|boolean|bool|timestamp|datetime|date|time|json|jsonb|uuid|serial|bigserial)\b)/g;

  const parts = code.split(regex);
  return parts.map((part, index) => {
    if (!part) return null;
    if (part.startsWith("//") || part.startsWith("/*")) {
      return (
        <span key={index} className="text-zinc-500 italic">
          {part}
        </span>
      );
    }
    if (part.startsWith("'") || part.startsWith('"')) {
      return (
        <span key={index} className="text-lime-400">
          {part}
        </span>
      );
    }
    if (part.startsWith("[")) {
      // Modificadores de coluna dentro de colchetes como [pk, increment] ou [not null]
      return (
        <span key={index} className="text-rose-400 font-medium">
          {part}
        </span>
      );
    }
    if (/^(?:TableGroup|Table|Enum|Ref|Note|Records|Project)$/.test(part)) {
      return (
        <span key={index} className="font-semibold text-amber-500">
          {part}
        </span>
      );
    }
    if (
      /^(?:int|integer|bigint|smallint|tinyint|varchar|char|text|decimal|numeric|float|double|boolean|bool|timestamp|datetime|date|time|json|jsonb|uuid|serial|bigserial)$/.test(
        part,
      )
    ) {
      return (
        <span key={index} className="text-sky-400">
          {part}
        </span>
      );
    }
    return (
      <span key={index} className="text-zinc-200">
        {part}
      </span>
    );
  });
}

export function DbmlEditor({
  value,
  theme,
  onChange,
  errors,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  saveStatus,
}: DbmlEditorProps) {
  const id = useId();
  const codeRef = useRef<HTMLPreElement>(null);
  const linesRef = useRef<HTMLDivElement>(null);

  return (
    <div
      data-theme={theme}
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-[#18181b] shadow-sm text-zinc-200 font-mono"
    >
      <div className="flex h-9 items-center justify-between border-b border-zinc-800/80 bg-[#18181b] px-4 text-xs font-semibold text-zinc-400">
        <span className="font-mono text-[11px] font-bold tracking-wider text-zinc-300">
          DBML
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="toolbar-button h-6 w-6 p-0 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 rounded hover:bg-zinc-800 flex items-center justify-center transition-colors"
            aria-label="Desfazer"
            title="Desfazer (Ctrl/⌘ Z)"
            disabled={!canUndo}
            onClick={onUndo}
          >
            ↶
          </button>
          <button
            type="button"
            className="toolbar-button h-6 w-6 p-0 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-30 rounded hover:bg-zinc-800 flex items-center justify-center transition-colors"
            aria-label="Refazer"
            title="Refazer (Ctrl/⌘ Shift Z)"
            disabled={!canRedo}
            onClick={onRedo}
          >
            ↷
          </button>
        </div>
        <span className="text-[11px] font-normal tabular-nums text-zinc-500">
          {value.length} chars
        </span>
      </div>

      <label htmlFor={id} className="sr-only">
        Editor DBML
      </label>

      <div className="relative flex min-h-0 flex-1 font-mono text-[13px] leading-6 bg-[#18181b]">
        <div
          ref={linesRef}
          aria-hidden="true"
          className="w-11 shrink-0 select-none overflow-hidden border-r border-zinc-800/70 bg-[#141416] py-3 text-right text-zinc-600"
        >
          {value.split("\n").map((_, index) => (
            <div className="pr-2.5 text-[12px]" key={index}>
              {index + 1}
            </div>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <pre
            ref={codeRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-3.5 font-inherit"
            style={{ font: "inherit" }}
          >
            {renderDbmlTokens(value)}
            {"\n"}
          </pre>
          <textarea
            id={id}
            value={value}
            spellCheck={false}
            wrap="off"
            onChange={(event) => onChange(event.target.value)}
            onScroll={(event) => {
              if (codeRef.current) {
                codeRef.current.scrollTop = event.currentTarget.scrollTop;
                codeRef.current.scrollLeft = event.currentTarget.scrollLeft;
              }
              if (linesRef.current) {
                linesRef.current.scrollTop = event.currentTarget.scrollTop;
              }
            }}
            onKeyDown={(event) => {
              if (
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === "z" &&
                onUndo
              ) {
                event.preventDefault();
                if (event.shiftKey) onRedo?.();
                else onUndo();
              }
            }}
            className="absolute inset-0 h-full w-full resize-none border-0 bg-transparent p-3.5 font-mono text-[13px] leading-6 text-transparent caret-white outline-none placeholder:text-zinc-600"
            placeholder="Table users { id integer [primary key] }"
          />
        </div>
      </div>

      {saveStatus && (
        <div className="flex items-center justify-between border-t border-zinc-800/80 bg-[#18181b] px-3.5 py-2 text-[11px] text-zinc-400 font-sans">
          <span role="status" className="flex items-center gap-1.5">
            {saveStatus === "saving" ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Salvando alterações…
              </>
            ) : saveStatus === "error" ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Não foi possível salvar as alterações.
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Alterações salvas
              </>
            )}
          </span>
          <span className="text-zinc-500">Última alteração há 3 minutos</span>
        </div>
      )}

      {errors && errors.length > 0 ? (
        <div className="max-h-28 overflow-auto border-t border-rose-950/60 bg-rose-950/20 px-3.5 py-2 text-[11px] text-rose-300">
          <p className="mb-1 font-semibold uppercase tracking-[0.16em] text-rose-400">
            {errors.length} aviso{errors.length === 1 ? "" : "s"}
          </p>
          <ul className="space-y-0.5">
            {errors.slice(0, 6).map((err, idx) => (
              <li key={idx} className="font-mono text-rose-200">
                {err}
              </li>
            ))}
            {errors.length > 6 ? (
              <li className="opacity-70">… {errors.length - 6} a mais</li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
