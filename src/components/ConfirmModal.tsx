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
  const isDark = theme === "dark";

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
      ? "border-red-600 bg-red-600 text-white hover:bg-red-500 focus:ring-red-400"
      : "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white hover:bg-zinc-800 focus:ring-zinc-400";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className={`w-full max-w-sm rounded border p-5 shadow-lg ${
          isDark
            ? "border-zinc-800 bg-[#161b22] text-zinc-200"
            : "border-zinc-200 bg-white text-zinc-900"
        }`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="confirm-modal-title"
          className="m-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100"
        >
          {title}
        </h2>
        <p
          id="confirm-modal-desc"
          className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400"
        >
          {description}
        </p>
        <div className="mt-5 flex items-center justify-end gap-2 border-t pt-3 border-zinc-200 dark:border-zinc-800">
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
            className={`inline-flex items-center justify-center rounded border px-3 h-7 text-xs font-medium transition focus:outline-none focus:ring-1 ${confirmButtonClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
