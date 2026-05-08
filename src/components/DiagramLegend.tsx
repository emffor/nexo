"use client";

import type { AppTheme } from "../lib/preferences";
import {
  DIAGRAM_STATUS_OPTIONS,
  DIAGRAM_STATUS_PALETTE,
} from "../types/diagram";

interface DiagramLegendProps {
  theme: AppTheme;
}

export function DiagramLegend({ theme }: DiagramLegendProps) {
  return (
    <div
      className={`pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1 rounded-md border px-3 py-2 text-[11px] backdrop-blur ${
        theme === "dark"
          ? "border-white/10 bg-ink/80 text-slate-200"
          : "border-slate-200 bg-white/90 text-slate-700"
      }`}
    >
      <span className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] opacity-70">
        Legenda
      </span>
      {DIAGRAM_STATUS_OPTIONS.map((option) => {
        const palette = DIAGRAM_STATUS_PALETTE[option.value][theme];
        return (
          <div key={option.value} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-5 rounded border"
              style={{
                backgroundColor: palette.fill,
                borderColor: palette.border,
              }}
            />
            <span>{option.label}</span>
          </div>
        );
      })}
    </div>
  );
}
