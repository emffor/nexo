"use client";

import { useId } from "react";
import type { AppTheme } from "../../lib/preferences";

interface DbmlEditorProps {
  value: string;
  theme: AppTheme;
  onChange: (next: string) => void;
  errors?: string[];
}

export function DbmlEditor({ value, theme, onChange, errors }: DbmlEditorProps) {
  const id = useId();

  return (
    <div
      data-theme={theme}
      className="nexo-surface flex h-full min-h-0 flex-col overflow-hidden rounded border border-[var(--ui-line)] bg-[var(--ui-surface)]"
    >
      <div
        className="nexo-dbml-heading flex items-center justify-between border-b px-5 py-5 text-base font-semibold border-[var(--ui-line)] text-[var(--ui-muted)]"
      >
        <span>DBML</span>
        <span className="text-[var(--ui-muted)]">
          {value.length} chars
        </span>
      </div>
      <label htmlFor={id} className="sr-only">
        Editor DBML
      </label>
      <textarea
        id={id}
        value={value}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        className="nexo-dbml-input flex-1 min-h-0 w-full resize-none border-0 px-5 py-4 font-mono text-[13px] leading-relaxed outline-none bg-transparent text-[var(--ui-text)] placeholder:text-[var(--ui-muted)]"
        placeholder="Table users { id integer [primary key] ... }"
      />
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
