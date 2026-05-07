'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { isContentBlank } from "../lib/items";
import type { AppTheme } from "../lib/preferences";
import { ConfirmModal } from "./ConfirmModal";

interface AddMarkdownModalProps {
  open: boolean;
  isSaving?: boolean;
  mode?: "create" | "edit";
  initialValue?: string;
  initialTitle?: string;
  theme?: AppTheme;
  isMac?: boolean;
  onClose: () => void;
  onSave: (content: string, title?: string) => Promise<void>;
}

export function AddMarkdownModal({
  open,
  isSaving = false,
  mode = "create",
  initialValue = "",
  initialTitle = "",
  theme = "dark",
  isMac = false,
  onClose,
  onSave,
}: AddMarkdownModalProps) {
  const isDark = theme === "dark";
  const dialogRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false);

  useFocusTrap(dialogRef, open && !showDirtyConfirm);

  const isDirty = open && (value !== initialValue || title !== initialTitle);

  const safeClose = useCallback(() => {
    if (isDirty) {
      setShowDirtyConfirm(true);
      return;
    }
    onClose();
  }, [isDirty, onClose]);

  useEffect(() => {
    if (!open) {
      setValue("");
      setTitle("");
      setError("");
      setShowDirtyConfirm(false);
      return;
    }

    setValue(initialValue);
    setTitle(initialTitle);
    setError("");
  }, [initialValue, initialTitle, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        safeClose();
      }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        const form = document.querySelector<HTMLFormElement>(
          '[aria-labelledby="add-markdown-title"] form',
        );
        form?.requestSubmit();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, safeClose]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isContentBlank(value)) {
      setError("Cole algum conteudo em markdown para continuar.");
      return;
    }

    await onSave(value, title.trim() || undefined);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm"
      role="presentation"
      onClick={safeClose}
    >
      <div
        ref={dialogRef}
        className={`w-full max-w-3xl rounded-[1.75rem] border p-5 backdrop-blur sm:p-6 ${
          isDark
            ? "border-slate-700/60 bg-[#141b24]"
            : "border-slate-200/80 bg-white/95"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-markdown-title"
        onClick={(event) => event.stopPropagation()}
      >
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p
                className={`mb-1 text-sm font-medium uppercase tracking-[0.2em] ${
                  isDark ? "text-teal-300/90" : "text-teal-700"
                }`}
              >
                {mode === "edit" ? "Editar card" : "Novo card"}
              </p>
              <h2
                id="add-markdown-title"
                className={`m-0 text-2xl font-semibold ${
                  isDark ? "text-slate-50" : "text-slate-950"
                }`}
              >
                {mode === "edit" ? "Editar markdown" : "Colar markdown"}
              </h2>
            </div>

            <button
              type="button"
              onClick={safeClose}
              className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                isDark
                  ? "border-slate-600 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              Fechar
            </button>
          </div>

          <label
            className={`flex flex-col gap-1.5 text-sm font-medium ${
              isDark ? "text-slate-300" : "text-slate-700"
            }`}
          >
            Titulo do card
            <span
              className={`text-xs font-normal ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              Opcional — se vazio, usa a primeira linha do markdown
            </span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex: Criacao de Pedido"
              className={`rounded-xl border px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200/40 ${
                isDark
                  ? "border-slate-700 bg-[#0b1118] text-slate-200 placeholder:text-slate-600"
                  : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"
              }`}
            />
          </label>

          <label
            className={`flex flex-col gap-2 text-sm font-medium ${
              isDark ? "text-slate-300" : "text-slate-700"
            }`}
          >
            Conteudo
            <textarea
              autoFocus
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              rows={14}
              placeholder={"# Titulo\n\nCole aqui o bloco em markdown."}
              className={`min-h-[280px] rounded-2xl border px-4 py-4 font-mono text-sm leading-6 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200/40 ${
                isDark
                  ? "border-slate-700 bg-[#0b1118] text-slate-200 placeholder:text-slate-600"
                  : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"
              }`}
            />
          </label>

          {error ? (
            <p
              className={`m-0 text-sm font-medium ${isDark ? "text-rose-400" : "text-rose-700"}`}
            >
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3">
            <p
              className={`m-0 text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              {isMac ? "⌘" : "Ctrl"}+Enter para salvar
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={safeClose}
                className={`rounded-full border px-5 py-3 text-sm font-semibold transition ${
                  isDark
                    ? "border-slate-600 text-slate-300 hover:border-slate-500 hover:text-slate-100"
                    : "border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-950"
                }`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-full bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-500 disabled:cursor-not-allowed disabled:bg-teal-800 disabled:text-teal-300"
              >
                {isSaving
                  ? "Salvando..."
                  : mode === "edit"
                    ? "Salvar alteracoes"
                    : "Salvar card"}
              </button>
            </div>
          </div>
        </form>
      </div>

      <ConfirmModal
        open={showDirtyConfirm}
        title="Descartar alteracoes?"
        description="Voce tem alteracoes nao salvas. Deseja realmente fechar e perder o conteudo?"
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        variant="danger"
        theme={theme}
        onConfirm={() => {
          setShowDirtyConfirm(false);
          onClose();
        }}
        onCancel={() => setShowDirtyConfirm(false)}
      />
    </div>
  );
}
