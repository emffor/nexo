"use client";

import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import type { AppTheme } from "../lib/preferences";
import {
  DIAGRAM_STATUS_OPTIONS,
  DIAGRAM_STATUS_PALETTE,
} from "../types/diagram";
import type { DiagramStatus } from "../types/markdown";
import { StatusDot } from "./StatusDot";

interface StatusPickerProps {
  status?: DiagramStatus;
  theme: AppTheme;
  label: string;
  buttonClassName?: string;
  dotClassName?: string;
  onChangeStatus: (status: DiagramStatus | undefined) => void;
}

export function StatusPicker({
  status,
  theme,
  label,
  buttonClassName = "",
  dotClassName = "",
  onChangeStatus,
}: StatusPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const selectedValue = status ?? "";

  useFocusTrap(dialogRef, isOpen);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  const options: Array<{ value: DiagramStatus | ""; label: string }> = [
    { value: "", label: "Sem status" },
    ...DIAGRAM_STATUS_OPTIONS,
  ];

  const handleSelect = (nextStatus: DiagramStatus | "") => {
    onChangeStatus(nextStatus === "" ? undefined : nextStatus);
    setIsOpen(false);
  };

  return (
    <>
      <button
        type="button"
        aria-label={`Alterar status de ${label}`}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus:ring-2 focus:ring-[var(--ui-accent)] ${buttonClassName}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(true);
        }}
      >
        <StatusDot status={status} theme={theme} className={dotClassName} />
      </button>

      {isOpen ? (
        <div
          data-theme={theme}
          className="nexo-ui fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] px-4 py-8 backdrop-blur-md"
          role="presentation"
          onClick={() => setIsOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Alterar status de ${label}`}
            className="nexo-dialog w-full max-w-xs overflow-hidden rounded-2xl border p-1.5 shadow-[var(--ui-shadow-strong)] border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-heading)]"
            onClick={(event) => event.stopPropagation()}
          >
            {options.map((option, index) => {
              const isSelected = option.value === selectedValue;
              const palette =
                option.value === ""
                  ? undefined
                  : DIAGRAM_STATUS_PALETTE[option.value][theme];

              return (
                <button
                  key={option.value}
                  ref={index === 0 ? closeButtonRef : undefined}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => handleSelect(option.value)}
                  className={`nexo-status-option flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-xs font-medium rounded-xl transition-all duration-150 ${
                    isSelected
                      ? "bg-[var(--ui-primary)] text-[var(--ui-on-primary)] shadow-sm"
                      : "text-[var(--ui-text)] hover:bg-[var(--ui-raised)]"
                  }`}
                >
                  <span className="w-4 text-center text-sm leading-none">
                    {isSelected ? "✓" : ""}
                  </span>
                  {palette ? (
                    <span
                      className="h-2.5 w-2.5 rounded-full border"
                      style={{
                        backgroundColor: palette.fill,
                        borderColor: palette.border,
                      }}
                      aria-hidden="true"
                    />
                  ) : (
                    <span className="h-2.5 w-2.5" aria-hidden="true" />
                  )}
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
