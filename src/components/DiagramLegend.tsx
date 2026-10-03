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
      className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-xl border border-[var(--ui-glass-border)] bg-[var(--ui-glass-bg)] px-3.5 py-2.5 text-[11px] backdrop-blur-xl shadow-[var(--ui-shadow)] text-[var(--ui-text)]"
    >
      <span className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] opacity-70">
        Legenda
      </span>
      {DIAGRAM_STATUS_OPTIONS.map((option) => {
        const palette = DIAGRAM_STATUS_PALETTE[option.value][theme];
        return (
          <div key={option.value} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-5 rounded-md border"
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
