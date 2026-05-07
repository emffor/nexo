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
      ? "bg-rose-600 text-white hover:bg-rose-500 focus:ring-rose-400"
      : "bg-teal-600 text-white hover:bg-teal-500 focus:ring-teal-400";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className={`w-full max-w-md rounded-2xl border p-6 shadow-xl ${
          isDark
            ? "border-slate-700/60 bg-[#141b24]"
            : "border-slate-200/80 bg-white"
        }`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="confirm-modal-title"
          className={`m-0 text-lg font-semibold ${
            isDark ? "text-slate-50" : "text-slate-900"
          }`}
        >
          {title}
        </h2>
        <p
          id="confirm-modal-desc"
          className={`mt-2 text-sm leading-6 ${
            isDark ? "text-slate-400" : "text-slate-600"
          }`}
        >
          {description}
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              isDark
                ? "border-slate-600 text-slate-300 hover:border-slate-500 hover:text-slate-100 focus:ring-slate-400 focus:ring-offset-[#141b24]"
                : "border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-950 focus:ring-slate-400 focus:ring-offset-white"
            }`}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-full px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${confirmButtonClass} ${
              isDark
                ? "focus:ring-offset-[#141b24]"
                : "focus:ring-offset-white"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
