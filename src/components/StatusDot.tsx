import type { AppTheme } from "../lib/preferences";
import {
  DIAGRAM_STATUS_OPTIONS,
  DIAGRAM_STATUS_PALETTE,
} from "../types/diagram";
import type { DiagramStatus } from "../types/markdown";

interface StatusDotProps {
  status?: DiagramStatus;
  theme: AppTheme;
  className?: string;
}

export function getStatusLabel(status?: DiagramStatus): string {
  const normalizedStatus = status ?? "backlog";
  return (
    DIAGRAM_STATUS_OPTIONS.find((option) => option.value === normalizedStatus)
      ?.label ?? "Não iniciado"
  );
}

export function StatusDot({ status, theme, className = "" }: StatusDotProps) {
  const normalizedStatus = status ?? "backlog";
  const palette = DIAGRAM_STATUS_PALETTE[normalizedStatus][theme];
  const label = getStatusLabel(normalizedStatus);

  return (
    <span
      title={`Status: ${label}`}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full border ${className}`}
      style={{
        backgroundColor: palette.fill,
        borderColor: palette.border,
      }}
    />
  );
}
