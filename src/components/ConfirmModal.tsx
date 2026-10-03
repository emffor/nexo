'use client';

import { useEffect, useRef } from "react";
import type { AppTheme } from "../lib/preferences";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  theme?: AppTheme;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  theme = "dark",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    cancelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  const confirmButtonClass =
    variant === "danger"
      ? "toolbar-button--destructive"
      : "toolbar-button--primary";

  return (
    <div
      data-theme={theme}
      className="nexo-ui fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] px-4 py-8"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="nexo-dialog w-full max-w-sm rounded border p-5 shadow-[var(--ui-shadow)] border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-heading)]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="confirm-modal-title"
          className="m-0 text-sm font-semibold text-[var(--ui-heading)]"
        >
          {title}
        </h2>
        <p
          id="confirm-modal-desc"
          className="mt-2 text-xs leading-5 text-[var(--ui-muted)]"
        >
          {description}
        </p>
        <div className="nexo-dialog-divider mt-5 flex items-center justify-end gap-2 border-t pt-3 border-[var(--ui-line)]">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="toolbar-button h-7 px-3 text-xs"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`toolbar-button ${confirmButtonClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
