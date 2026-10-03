"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePreferences } from "../contexts/PreferencesContext";
import { useDatabaseDiagram } from "../hooks/useDatabaseDiagram";
import { useMarkdownBoard } from "../hooks/useMarkdownBoard";
import { useScrollSync } from "../hooks/useScrollSync";
import { useToast } from "../hooks/useToast";
import {
  createBackupText,
  parseBackupFile
} from "../lib/backup";
import { buildCombinedContent } from "../lib/items";
import {
  type ViewMode
} from "../lib/preferences";
import { getSelectionPreviewItemId, toggleStrikethroughInContent } from "../lib/previewStrikethrough";
import {
  remapDiagramState,
  remapHiddenDiagramItemIds,
  updateProjectDiagramState,
  updateProjectHiddenDiagramItemIds
} from "../lib/projects";
import { downloadTextFile, readTextFile } from "../lib/textFiles";
import type { DiagramState } from "../types/diagram";
import type { MarkdownItem } from "../types/markdown";
import type { Project } from "../types/project";
const EMPTY_DIAGRAM_STATE: DiagramState = { positions: {}, edges: [] };

export function useProjectWorkspace(project: Project) {
  const [workspaceProject, setWorkspaceProject] = useState(project);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<MarkdownItem | null>(null);
  const [selectedItemId, setActiveItemId] = useState<string | null>(null);
  const [isScrollSyncEnabled, setIsScrollSyncEnabled] = useState(false);
  const { theme, setTheme, viewMode, setViewMode, diagramEdgeStyle,
    setDiagramEdgeStyle, databaseEdgeStyle, setDatabaseEdgeStyle, fontScale,
    setFontScale, isPreviewMaximized, setIsPreviewMaximized } = usePreferences();
  const [isDiagramSidebarVisible, setIsDiagramSidebarVisible] = useState(true);
  const [storedHiddenItemIds, setHiddenDiagramItemIds] = useState<Set<string>>(
    () => new Set(project.hiddenDiagramItemIds ?? []),
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const diagramStateRef = useRef<DiagramState | null>(
    project.diagramState ?? null,
  );
  const {
    items,
    addItem,
    updateItem,
    updateItemStatus,
    updateItemObservation,
    deleteItem,
    reorderItems,
    clearItems,
    replaceItems,
    isLoading,
    loadError,
    retryLoad,
  } = useMarkdownBoard(project.id);
  const { leftScrollRef, rightScrollRef } = useScrollSync(
    isScrollSyncEnabled && !isPreviewMaximized && (viewMode === "normal" || viewMode === "index"),
    items.length,
  );
  const [diagramResetSignal, setDiagramResetSignal] = useState(0);
  const [diagramClearEdgesSignal, setDiagramClearEdgesSignal] = useState(0);
  const [diagramReloadStateSignal, setDiagramReloadStateSignal] = useState(0);
  const { messages, addToast, dismissToast } = useToast();
  const {
    databaseDiagram,
    databaseParseResult,
    databaseResetSignal,
    canUndoDatabase,
    canRedoDatabase,
    undoDatabase,
    redoDatabase,
    databaseSaveStatus,
    databaseLoadError,
    retryDatabaseLoad,
    getCurrentDatabaseDiagram,
    onDatabaseContentChange,
    onDatabaseStateChange,
    onRenameDatabaseTable,
    onRenameDatabaseColumn,
    replaceDatabaseDiagramRecord,
    resetDatabaseDiagramToDefault,
  } = useDatabaseDiagram({
    projectId: project.id,
    onAutosaveError: () => {
      addToast(
        "Nao foi possivel salvar automaticamente o diagrama de banco.",
        "error",
      );
    },
  });
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [deletingItem, setDeletingItem] = useState<MarkdownItem | null>(null);

  const activeItemId = items.some((item) => item.id === selectedItemId)
    ? selectedItemId
    : items[0]?.id ?? null;

  const hiddenDiagramItemIds = useMemo(() => {
    if (isLoading) return storedHiddenItemIds;
    const validIds = new Set(items.map((item) => item.id));
    return new Set([...storedHiddenItemIds].filter((id) => validIds.has(id)));
  }, [isLoading, items, storedHiddenItemIds]);

  const handleSave = async (content: string, title?: string) => {
    setIsSaving(true);

    try {
      if (editingItem) {
        await updateItem(editingItem.id, content, title);
        addToast("Card atualizado com sucesso");
      } else {
        await addItem(content, title);
        addToast("Novo card adicionado");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearAll = () => {
    if (items.length === 0 && !databaseDiagram) {
      return;
    }
    setConfirmClearAll(true);
  };

  const executeClearAll = async () => {
    setConfirmClearAll(false);
    const snapshot = [...items];
    const previousDiagramState = diagramStateRef.current ?? EMPTY_DIAGRAM_STATE;
    const previousHiddenIds = [...hiddenDiagramItemIds];
    const previousDatabaseDiagram = await getCurrentDatabaseDiagram();
    await updateProjectDiagramState(project.id, EMPTY_DIAGRAM_STATE);
    await updateProjectHiddenDiagramItemIds(project.id, []);
    await clearItems();
    await resetDatabaseDiagramToDefault();
    diagramStateRef.current = EMPTY_DIAGRAM_STATE;
    setHiddenDiagramItemIds(new Set());
    setWorkspaceProject((current) => ({
      ...current,
      diagramState: EMPTY_DIAGRAM_STATE,
      hiddenDiagramItemIds: [],
    }));
    addToast(
      "Dados removidos e banco restaurado para o exemplo inicial",
      "info",
      {
        label: "Desfazer",
        onClick: () => {
          void (async () => {
            await replaceItems(snapshot);
            await updateProjectDiagramState(project.id, previousDiagramState);
            await updateProjectHiddenDiagramItemIds(project.id, previousHiddenIds);
            await replaceDatabaseDiagramRecord(previousDatabaseDiagram);
            diagramStateRef.current = previousDiagramState;
            setHiddenDiagramItemIds(new Set(previousHiddenIds));
            setWorkspaceProject((current) => ({ ...current, diagramState: previousDiagramState, hiddenDiagramItemIds: previousHiddenIds }));
            setDiagramReloadStateSignal((value) => value + 1);
          })().catch(() => addToast("Não foi possível restaurar todos os dados.", "error"));
        },
      },
    );
  };

  const handleExport = async () => {
    const diagramState = diagramStateRef.current ?? workspaceProject.diagramState;
    const currentDatabaseDiagram = await getCurrentDatabaseDiagram();
    const backupText = createBackupText(
      items,
      diagramState,
      [...hiddenDiagramItemIds],
      currentDatabaseDiagram,
    );
    downloadTextFile(`${workspaceProject.name}-backup.txt`, backupText);
    addToast(`Backup exportado com ${items.length} card(s)`);
  };

  const handleDiagramStateChange = useCallback((state: DiagramState) => {
    diagramStateRef.current = state;
    setWorkspaceProject((current) => ({
      ...current,
      diagramState: state,
    }));
    void updateProjectDiagramState(project.id, state).catch(() => {
      addToast("Não foi possível salvar o diagrama de cards.", "error");
    });
  }, [project.id, addToast]);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const rawText = await readTextFile(file);
      const importedBackup = parseBackupFile(rawText);
      const itemIdMap = new Map(importedBackup.items.map((item) => [item.id, crypto.randomUUID()]));
      await replaceItems(importedBackup.items.map((item) => ({ ...item, id: itemIdMap.get(item.id)! })));
      const nextDiagramState = remapDiagramState(importedBackup.diagramState, itemIdMap) ?? EMPTY_DIAGRAM_STATE;
      const nextHiddenItemIds = remapHiddenDiagramItemIds(importedBackup.hiddenDiagramItemIds, itemIdMap);
      diagramStateRef.current = nextDiagramState;
      setHiddenDiagramItemIds(new Set(nextHiddenItemIds));
      setWorkspaceProject((current) => ({
        ...current,
        diagramState: nextDiagramState,
        hiddenDiagramItemIds: nextHiddenItemIds,
      }));
      await updateProjectDiagramState(project.id, nextDiagramState);
      await updateProjectHiddenDiagramItemIds(project.id, nextHiddenItemIds);
      setDiagramReloadStateSignal((value) => value + 1);
      if (importedBackup.databaseDiagram) {
        await replaceDatabaseDiagramRecord(importedBackup.databaseDiagram);
      }
      addToast(
        `${importedBackup.items.length} card(s) importado(s) com sucesso`,
      );
    } catch {
      addToast("Nao foi possivel importar este arquivo.", "error");
    } finally {
      event.target.value = "";
    }
  };

  const handleDeleteItem = (item: MarkdownItem) => {
    setDeletingItem(item);
  };

  const executeDeleteItem = async () => {
    if (!deletingItem) {
      return;
    }
    const itemId = deletingItem.id;
    setDeletingItem(null);
    await deleteItem(itemId);
    addToast("Card removido", "info");
  };

  const handleCopyAll = useCallback(async () => {
    if (items.length === 0) {
      addToast("Nenhum card para copiar", "error");
      return;
    }
    try {
      const combined = buildCombinedContent(items);
      await navigator.clipboard.writeText(combined);
      addToast("Markdown copiado para a area de transferencia");
    } catch {
      addToast("Nao foi possivel copiar para a area de transferencia", "error");
    }
  }, [items, addToast]);

  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(navigator.userAgent.includes("Mac"));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key === "n") {
        event.preventDefault();
        setIsModalOpen(true);
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        void handleCopyAll();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleCopyAll]);

  const resetScrollToTop = () => {
    try {
      if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
    } catch {
      // Ignora ambientes sem suporte a scrollTo (ex: jsdom)
    }
    if (typeof document !== "undefined") {
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
    if (rightScrollRef.current) {
      rightScrollRef.current.scrollTop = 0;
    }
  };

  const handleSelectItem = (item: MarkdownItem) => {
    setActiveItemId(item.id);
    resetScrollToTop();
  };

  const handleSelectItemFromList = (item: MarkdownItem) => {
    setActiveItemId(item.id);
    resetScrollToTop();
  };

  const handleTogglePreviewStrikethrough = useCallback(async () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString() ?? "";

    if (!selection || selectedText.trim().length === 0) {
      addToast("Selecione um texto no preview para alternar o risco", "error");
      return;
    }

    const selectedItemId = getSelectionPreviewItemId(selection);
    const selectedItem = items.find((item) => item.id === selectedItemId);

    if (!selectedItem) {
      addToast("Selecione um texto dentro de um card do preview", "error");
      return;
    }

    const nextContent = toggleStrikethroughInContent(
      selectedItem.content,
      selectedText,
    );

    if (!nextContent) {
      addToast("Nao foi possivel localizar esse texto no markdown", "error");
      return;
    }

    await updateItem(selectedItem.id, nextContent, selectedItem.title);
    selection.removeAllRanges();
    setActiveItemId(selectedItem.id);
    addToast("Risco alternado no card");
  }, [addToast, items, updateItem]);

  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const storedDataSizeBytes = useMemo(
    () =>
      new Blob([
        JSON.stringify({
          items,
          databaseDiagram,
        }),
      ]).size,
    [databaseDiagram, items],
  );

  const handleResetDatabaseLayout = useCallback(() => {
    void resetDatabaseDiagramToDefault().then(() => {
      addToast("Banco restaurado para o exemplo inicial", "info");
    }).catch(() => addToast("Não foi possível restaurar o banco.", "error"));
  }, [addToast, resetDatabaseDiagramToDefault]);

  const handleSelectDiagramItem = (item: MarkdownItem) => {
    setActiveItemId(item.id);
  };

  const handleToggleDiagramItemVisibility = (itemId: string) => {
    const next = new Set(hiddenDiagramItemIds);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setHiddenDiagramItemIds(next);
    void updateProjectHiddenDiagramItemIds(project.id, [...next]).catch(() => {
      addToast("Nao foi possivel salvar a visibilidade dos cards.", "error");
    });
  };

  const handleResetDiagramLayout = () => {
    setDiagramResetSignal((value) => value + 1);
    addToast("Layout do diagrama reorganizado", "info");
  };

  const handleClearDiagramEdges = () => {
    setDiagramClearEdgesSignal((value) => value + 1);
    addToast("Setas do diagrama removidas", "info");
  };

  return {
    workspaceProject,
    diagramStateRef,
    isModalOpen,
    setIsModalOpen,
    isSaving,
    editingItem,
    setEditingItem,
    isScrollSyncEnabled,
    setIsScrollSyncEnabled,
    theme,
    setTheme,
    viewMode,
    diagramEdgeStyle,
    setDiagramEdgeStyle,
    databaseEdgeStyle,
    setDatabaseEdgeStyle,
    fontScale,
    setFontScale,
    isPreviewMaximized,
    setIsPreviewMaximized,
    isDiagramSidebarVisible,
    setIsDiagramSidebarVisible,
    hiddenDiagramItemIds,
    fileInputRef,
    items,
    updateItemStatus,
    updateItemObservation,
    reorderItems,
    isLoading,
    loadError,
    retryLoad,
    leftScrollRef,
    rightScrollRef,
    diagramResetSignal,
    diagramClearEdgesSignal,
    diagramReloadStateSignal,
    messages,
    dismissToast,
    reportActionError: () => addToast("Não foi possível concluir a operação. Tente novamente.", "error"),
    databaseDiagram,
    databaseParseResult,
    databaseResetSignal,
    canUndoDatabase,
    canRedoDatabase,
    undoDatabase,
    redoDatabase,
    databaseSaveStatus,
    databaseLoadError,
    retryDatabaseLoad,
    onDatabaseContentChange,
    onDatabaseStateChange,
    onRenameDatabaseTable,
    onRenameDatabaseColumn,
    confirmClearAll,
    setConfirmClearAll,
    deletingItem,
    setDeletingItem,
    activeItemId,
    handleSave,
    handleClearAll,
    executeClearAll,
    handleExport,
    handleDiagramStateChange,
    handleImportClick,
    handleImportFile,
    handleDeleteItem,
    executeDeleteItem,
    handleCopyAll,
    isMac,
    handleSelectItem,
    handleSelectItemFromList,
    handleTogglePreviewStrikethrough,
    handleSetViewMode,
    storedDataSizeBytes,
    handleResetDatabaseLayout,
    handleSelectDiagramItem,
    handleToggleDiagramItemVisibility,
    handleResetDiagramLayout,
    handleClearDiagramEdges,
  };
}
