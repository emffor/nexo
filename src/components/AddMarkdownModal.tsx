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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const handleApplyStrikethrough = () => {
    const textarea = textareaRef.current;
    const placeholder = "texto riscado";
    const selectionStart = textarea?.selectionStart ?? value.length;
    const selectionEnd = textarea?.selectionEnd ?? value.length;
    const selectedText = value.slice(selectionStart, selectionEnd);
    const textToFormat = selectedText || placeholder;
    const formattedText = `~~${textToFormat}~~`;
    const nextValue =
      value.slice(0, selectionStart) +
      formattedText +
      value.slice(selectionEnd);

    setValue(nextValue);
    if (error) {
      setError("");
    }

    window.requestAnimationFrame(() => {
      textarea?.focus();

      if (selectedText) {
        textarea?.setSelectionRange(
          selectionStart,
          selectionStart + formattedText.length,
        );
        return;
      }

      const placeholderStart = selectionStart + 2;
      textarea?.setSelectionRange(
        placeholderStart,
        placeholderStart + placeholder.length,
      );
    });
  };

  const handleRemoveStrikethrough = () => {
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? value.length;
    const selectionEnd = textarea?.selectionEnd ?? value.length;
    const selectedText = value.slice(selectionStart, selectionEnd);

    if (!selectedText) {
      textarea?.focus();
      return;
    }

    const hasSelectedMarkers =
      selectedText.startsWith("~~") && selectedText.endsWith("~~");
    const hasAdjacentMarkers =
      value.slice(selectionStart - 2, selectionStart) === "~~" &&
      value.slice(selectionEnd, selectionEnd + 2) === "~~";

    if (!hasSelectedMarkers && !hasAdjacentMarkers) {
      textarea?.focus();
      return;
    }

    const cleanText = hasSelectedMarkers
      ? selectedText.slice(2, -2)
      : selectedText;
    const nextValue = hasSelectedMarkers
      ? value.slice(0, selectionStart) + cleanText + value.slice(selectionEnd)
      : value.slice(0, selectionStart - 2) +
        cleanText +
        value.slice(selectionEnd + 2);
    const nextSelectionStart = hasSelectedMarkers
      ? selectionStart
      : selectionStart - 2;

    setValue(nextValue);
    if (error) {
      setError("");
    }

    window.requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(
        nextSelectionStart,
        nextSelectionStart + cleanText.length,
      );
    });
  };

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8"
      role="presentation"
      onClick={safeClose}
    >
      <div
        ref={dialogRef}
        className={`w-full max-w-3xl rounded border p-5 ${
          isDark
            ? "border-zinc-800 bg-[#161b22] text-zinc-200"
            : "border-zinc-200 bg-white text-zinc-900"
        } shadow-lg`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-markdown-title"
        onClick={(event) => event.stopPropagation()}
      >
        <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between border-b pb-2.5 border-zinc-200 dark:border-zinc-800">
            <h2
              id="add-markdown-title"
              className="m-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100"
            >
              {mode === "edit" ? "Editar Bloco Markdown" : "Novo Bloco Markdown"}
            </h2>

            <button
              type="button"
              onClick={safeClose}
              className="toolbar-button h-6 px-2 text-xs"
            >
              ✕
            </button>
          </div>

          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Título do card (opcional)
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex: P2M-1185 ou Criacao de Pedido"
              className={`h-8 rounded border px-2.5 text-xs outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 ${
                isDark
                  ? "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
                  : "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400"
              }`}
            />
          </label>

          <div className="flex flex-col gap-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
            <div className="flex items-center justify-between">
              <label htmlFor="markdown-content">Conteúdo Markdown</label>
              <div
                className="flex items-center gap-1"
                aria-label="Ferramentas de formatacao"
                role="toolbar"
              >
                <button
                  type="button"
                  onClick={handleApplyStrikethrough}
                  className="toolbar-button h-6 px-2 text-xs line-through"
                  title="Riscar texto selecionado"
                >
                  S
                </button>
                <button
                  type="button"
                  onClick={handleRemoveStrikethrough}
                  className="toolbar-button h-6 px-2 text-xs"
                  title="Desriscar texto selecionado"
                >
                  Limpar risco
                </button>
              </div>
            </div>

            <textarea
              id="markdown-content"
              ref={textareaRef}
              autoFocus
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              rows={12}
              placeholder={"# Titulo\n\nCole aqui o conteudo em markdown."}
              className={`rounded border p-3 font-mono text-xs leading-5 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 ${
                isDark
                  ? "border-zinc-700 bg-zinc-900 text-zinc-200 placeholder:text-zinc-600"
                  : "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400"
              }`}
            />
          </div>

          {error ? (
            <p className="m-0 text-xs text-red-500 font-medium">
              {error}
            </p>
          ) : null}

          <div className="flex items-center justify-between border-t pt-3 border-zinc-200 dark:border-zinc-800">
            <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
              {isMac ? "⌘" : "Ctrl"}+Enter para salvar
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={safeClose}
                className="toolbar-button h-7 px-3 text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="toolbar-button toolbar-button--accent h-7 px-3 text-xs"
              >
                {isSaving
                  ? "Salvando..."
                  : mode === "edit"
                    ? "Salvar alterações"
                    : "Criar card"}
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
