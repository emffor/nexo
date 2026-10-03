'use client';

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { isContentBlank } from "../lib/items";
import { getJiraIssueKey } from "../lib/jiraIssueKey";
import { getJiraCardApi } from "../services/jiraApi";
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false);
  const [showJiraConfirm, setShowJiraConfirm] = useState(false);
  const [isLoadingJira, setIsLoadingJira] = useState(false);
  const [jiraMessage, setJiraMessage] = useState("");
  const jiraRequestRef = useRef<AbortController | null>(null);
  const jiraTimerRef = useRef<number | undefined>(undefined);
  const issueKey = getJiraIssueKey(title);

  useFocusTrap(dialogRef, open && !showDirtyConfirm && !showJiraConfirm);

  const loadJira = useCallback(async (key: string) => {
    window.clearTimeout(jiraTimerRef.current);
    jiraRequestRef.current?.abort();
    const controller = new AbortController();
    jiraRequestRef.current = controller;
    setIsLoadingJira(true);
    setError("");
    setJiraMessage("");
    try {
      const card = await getJiraCardApi(key, controller.signal);
      if (controller.signal.aborted) return;
      setTitle(card.title);
      setValue(card.content);
      setJiraMessage("Task importada do Jira. Revise o conteúdo antes de salvar.");
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : "Falha ao buscar task no Jira.");
      }
    } finally {
      if (jiraRequestRef.current === controller) setIsLoadingJira(false);
    }
  }, []);

  useEffect(() => {
    if (!open || mode !== "create" || !issueKey || !isContentBlank(value)) return;
    const timer = window.setTimeout(() => { void loadJira(issueKey); }, 700);
    jiraTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      jiraRequestRef.current?.abort();
    };
  }, [open, mode, issueKey, value, loadJira]);

  useEffect(() => () => { jiraRequestRef.current?.abort(); }, [open, initialTitle, initialValue]);

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
      setShowJiraConfirm(false);
      setIsLoadingJira(false);
      setJiraMessage("");
      return;
    }

    setValue(initialValue);
    setTitle(initialTitle);
    setError("");
    setJiraMessage("");
  }, [initialValue, initialTitle, open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (showJiraConfirm || showDirtyConfirm) return;
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
  }, [open, onClose, safeClose, showJiraConfirm, showDirtyConfirm]);

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
    if (isSaving || isLoadingJira || showJiraConfirm || showDirtyConfirm) return;

    if (isContentBlank(value)) {
      setError("Cole algum conteudo em markdown para continuar.");
      return;
    }

    await onSave(value, title.trim() || undefined);
    onClose();
  };

  return (
    <div
      data-theme={theme}
      className="nexo-ui fixed inset-0 z-50 flex items-center justify-center bg-[var(--ui-overlay)] px-4 py-8"
      role="presentation"
      onClick={safeClose}
    >
      <div
        ref={dialogRef}
        className="nexo-dialog w-full max-w-3xl rounded border p-5 border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-heading)] shadow-[var(--ui-shadow)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-markdown-title"
        onClick={(event) => event.stopPropagation()}
      >
        <form className="flex flex-col gap-3.5" onSubmit={handleSubmit}>
          <div className="flex items-center justify-between border-b pb-2.5 border-[var(--ui-line)]">
            <h2
              id="add-markdown-title"
              className="m-0 text-sm font-semibold text-[var(--ui-heading)]"
            >
              {mode === "edit" ? "Editar Bloco Markdown" : "Novo Bloco Markdown"}
            </h2>

            <button
              type="button"
              onClick={safeClose}
              aria-label="Fechar modal"
              className="toolbar-button h-6 px-2 text-xs"
            >
              <Image src="/venture/close.svg" width={16} height={16} alt="" className="nexo-nav-icon" />
            </button>
          </div>

          <label className="flex flex-col gap-1 text-xs font-medium text-[var(--ui-text)]">
            Título do card (opcional)
            <input
              type="text"
              value={title}
              onChange={(event) => {
                jiraRequestRef.current?.abort();
                setIsLoadingJira(false);
                setJiraMessage("");
                setError("");
                setTitle(event.target.value);
              }}
              placeholder="Ex: P2M-1185 ou Criacao de Pedido"
              className="nexo-field w-full rounded border px-2.5 text-xs outline-none transition focus:border-[var(--ui-accent)] focus:ring-1 focus:ring-[var(--ui-accent)] border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-heading)] placeholder:text-[var(--ui-muted)]"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ui-muted)]">
            <button
              type="button"
              className="toolbar-button h-7 px-3 text-xs"
              disabled={!issueKey || isLoadingJira || isSaving}
              onClick={() => {
                if (!issueKey) return;
                if (!isContentBlank(value)) {
                  setShowJiraConfirm(true);
                } else {
                  void loadJira(issueKey);
                }
              }}
            >
              {isLoadingJira ? "Buscando no Jira..." : "Buscar no Jira"}
            </button>
            <span role="status">
              {jiraMessage || (isLoadingJira
                ? "Carregando task..."
                : "Digite a chave ou URL da task. Cards novos com conteúdo vazio buscam automaticamente.")}
            </span>
          </div>

          <div className="flex flex-col gap-1.5 text-xs font-medium text-[var(--ui-text)]">
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
                  disabled={isLoadingJira}
                  className="toolbar-button h-6 px-2 text-xs line-through"
                  title="Riscar texto selecionado"
                >
                  S
                </button>
                <button
                  type="button"
                  onClick={handleRemoveStrikethrough}
                  disabled={isLoadingJira}
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
              disabled={isLoadingJira}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              rows={12}
              placeholder={"# Titulo\n\nCole aqui o conteudo em markdown."}
              className="nexo-field rounded border p-3 font-mono text-xs leading-5 outline-none transition focus:border-[var(--ui-accent)] focus:ring-1 focus:ring-[var(--ui-accent)] border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-heading)] placeholder:text-[var(--ui-muted)]"
            />
          </div>

          {error ? (
            <p role="alert" className="m-0 text-xs text-[var(--ui-danger)] font-medium">
              {error}
            </p>
          ) : null}

          <div className="nexo-dialog-divider flex flex-wrap items-center justify-between gap-3 border-t pt-3 border-[var(--ui-line)]">
            <span className="text-[11px] text-[var(--ui-muted)]">
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
                disabled={isSaving || isLoadingJira}
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
        open={showJiraConfirm}
        title="Substituir conteúdo pelo Jira?"
        description="A busca substituirá o Markdown atual pela versão da task no Jira. O card só será atualizado quando você salvar."
        confirmLabel="Buscar e substituir"
        theme={theme}
        onConfirm={() => {
          setShowJiraConfirm(false);
          if (issueKey) void loadJira(issueKey);
        }}
        onCancel={() => setShowJiraConfirm(false)}
      />

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
