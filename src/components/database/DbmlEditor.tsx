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
  const isDark = theme === "dark";

  return (
    <div
      className={`nexo-surface flex h-full min-h-0 flex-col overflow-hidden rounded-[1.25rem] border ${
        isDark ? "border-white/10 bg-ink/70" : "border-slate-200 bg-white"
      }`}
    >
      <div
        className={`flex items-center justify-between border-b px-5 py-5 text-base font-semibold ${
          isDark
            ? "border-white/10 text-slate-300"
            : "border-slate-200 text-slate-500"
        }`}
      >
        <span>DBML</span>
        <span className={isDark ? "text-slate-400" : "text-slate-500"}>
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
        className={`flex-1 min-h-0 w-full resize-none border-0 px-5 py-4 font-mono text-[13px] leading-relaxed outline-none ${
          isDark
            ? "bg-transparent text-slate-100 placeholder:text-slate-500"
            : "bg-transparent text-slate-800 placeholder:text-slate-400"
        }`}
        placeholder="Table users { id integer [primary key] ... }"
      />
      {errors && errors.length > 0 ? (
        <div
          className={`max-h-32 overflow-auto border-t px-4 py-2 text-[11px] ${
            isDark
              ? "border-white/10 bg-rose-500/[0.06] text-rose-200"
              : "border-slate-200 bg-rose-50 text-rose-700"
          }`}
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
