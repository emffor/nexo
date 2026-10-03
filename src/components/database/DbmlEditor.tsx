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
  saveStatus?: 'saved' | 'saving' | 'error';
}

export function DbmlEditor({ value, theme, onChange, errors, onUndo, onRedo, canUndo, canRedo, saveStatus }: DbmlEditorProps) {
  const id = useId();
  const codeRef = useRef<HTMLPreElement>(null);
  const linesRef = useRef<HTMLDivElement>(null);
  const tokens = value.split(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|'''[\s\S]*?'''|'[^']*'|"[^"]*"|\b(?:TableGroup|Table|Enum|Ref|Note|Records|pk|primary key|not null|increment|unique)\b)/g);


  return (
    <div
      data-theme={theme}
      className="nexo-surface flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--ui-line)] bg-[var(--ui-surface)] shadow-sm"
    >
      <div
        className="nexo-dbml-heading flex items-center justify-between border-b px-5 py-4 text-sm font-semibold border-[var(--ui-line)] text-[var(--ui-heading)]"
      >
        <span>DBML</span>
        <div className="flex gap-1">
          <button type="button" className="toolbar-button px-2 disabled:opacity-40" aria-label="Desfazer" title="Desfazer (Ctrl/⌘ Z)" disabled={!canUndo} onClick={onUndo}>↶</button>
          <button type="button" className="toolbar-button px-2 disabled:opacity-40" aria-label="Refazer" title="Refazer (Ctrl/⌘ Shift Z)" disabled={!canRedo} onClick={onRedo}>↷</button>
        </div>
        <span className="text-xs font-normal tabular-nums text-[var(--ui-muted)]">
          {value.length} chars
        </span>
      </div>
      <label htmlFor={id} className="sr-only">
        Editor DBML
      </label>
      <div className="relative flex min-h-0 flex-1 font-mono text-[13px] leading-6">
        <div ref={linesRef} aria-hidden="true" className="w-12 shrink-0 overflow-hidden border-r border-[var(--ui-line)] bg-[var(--ui-raised)] py-4 text-right text-[var(--ui-muted)]">
          {value.split('\n').map((_, index) => <div className="pr-3" key={index}>{index + 1}</div>)}
        </div>
        <div className="relative min-w-0 flex-1">
          <pre ref={codeRef} aria-hidden="true" className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-4 font-inherit" style={{ font: 'inherit' }}>
            {tokens.map((token, index) => <span key={index} style={{ color: index % 2 === 0 ? 'var(--ui-text)' : token.startsWith('/') ? 'var(--ui-muted)' : token.startsWith("'") || token.startsWith('"') ? 'var(--ui-accent)' : 'var(--ui-heading)', fontWeight: index % 2 ? 600 : 400 }}>{token}</span>)}{'\n'}
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
              if (linesRef.current) linesRef.current.scrollTop = event.currentTarget.scrollTop;
            }}
            onKeyDown={(event) => {
              if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && onUndo) {
                event.preventDefault();
                if (event.shiftKey) onRedo?.(); else onUndo();
              }
            }}
            className="absolute inset-0 h-full w-full resize-none border-0 bg-transparent p-4 font-mono text-[13px] leading-6 text-transparent caret-[var(--ui-text)] outline-none placeholder:text-[var(--ui-muted)]"
            placeholder="Table users { id integer [primary key] }"
          />
        </div>
      </div>
      {saveStatus && <div role="status" className="border-t border-[var(--ui-line)] px-4 py-2 text-xs text-[var(--ui-muted)]">
        {saveStatus === 'saving' ? 'Salvando alterações…' : saveStatus === 'error' ? 'Não foi possível salvar as alterações.' : 'Alterações salvas'}
      </div>}
      {errors && errors.length > 0 ? (
        <div
          className="max-h-32 overflow-auto border-t px-4 py-2 text-[11px] border-[var(--ui-line)] bg-[var(--ui-danger-soft)] text-[var(--ui-danger)]"
        >
          <p className="mb-1 font-semibold uppercase tracking-[0.16em]">
            {errors.length} aviso{errors.length === 1 ? "" : "s"}
          </p>
          <ul className="space-y-0.5">
            {errors.slice(0, 6).map((err, idx) => (
              <li key={idx} className="font-mono">
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
