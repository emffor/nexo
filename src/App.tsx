"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "./components/AppShell";
import { AddMarkdownModal } from "./components/AddMarkdownModal";
import { ConfirmModal } from "./components/ConfirmModal";
import { CombinedOutputPanel } from "./components/CombinedOutputPanel";
import { DbmlEditor } from "./components/database/DbmlEditor";
import { DiagramSidebar } from "./components/DiagramSidebar";
import { ProjectsHome } from "./components/ProjectsHome";
import { SortableCardsPanel } from "./components/SortableCardsPanel";
import { ToastContainer } from "./components/Toast";
import { useDatabaseDiagram } from "./hooks/useDatabaseDiagram";
import { useMarkdownBoard } from "./hooks/useMarkdownBoard";
import { useToast } from "./hooks/useToast";
import {
  createBackupText,
  createCompleteBackupText,
  parseBackupFile,
  parseProjectsBackupFile,
} from "./lib/backup";
import { buildCombinedContent, getDisplayTitle } from "./lib/items";

const DiagramPanel = dynamic(() => import("./components/DiagramPanel"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[480px] w-full items-center justify-center rounded-[1.25rem] border border-white/10 bg-ink/40 text-sm text-slate-400">
      Carregando diagrama...
    </div>
  ),
});

const DatabaseDiagramPanel = dynamic(
  () => import("./components/database/DatabaseDiagramPanel"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[480px] w-full items-center justify-center rounded-[1.25rem] border border-white/10 bg-ink/40 text-sm text-slate-400">
        Carregando diagrama de banco...
      </div>
    ),
  },
);
import {
  type AppTheme,
  type DiagramEdgeStyle,
  type ViewMode,
  clampFontScale,
  FONT_SCALE,
  readStoredDatabaseEdgeStyle,
  readStoredDiagramEdgeStyle,
  readStoredCompactMode,
  readStoredFontScale,
  readStoredPreviewMaximized,
  readStoredSelectedProjectId,
  readStoredTheme,
  readStoredViewMode,
  STORAGE_KEYS,
} from "./lib/preferences";
import {
  createProject,
  deleteProject,
  getAllProjectsData,
  getProjectData,
  getProjectSummaries,
  importProjectsBackup,
  renameProject,
  updateProjectDiagramState,
  updateProjectHiddenDiagramItemIds,
  type ProjectSummary,
} from "./lib/projects";
import type { DiagramState } from "./types/diagram";
import type { MarkdownItem } from "./types/markdown";
import type { Project } from "./types/project";

const EMPTY_DIAGRAM_STATE: DiagramState = {
  positions: {},
  edges: [],
};

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function readTextFile(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(file);
  });
}

function getSelectionPreviewItemId(selection: Selection): string | null {
  const selectedNode = selection.rangeCount
    ? selection.getRangeAt(0).commonAncestorContainer
    : selection.anchorNode;
  const selectedElement =
    selectedNode instanceof HTMLElement
      ? selectedNode
      : selectedNode?.parentElement;

  return (
    selectedElement?.closest<HTMLElement>("[data-preview-item-id]")?.dataset
      .previewItemId ?? null
  );
}

function addStrikethroughToContent(
  content: string,
  selectedText: string,
): string | null {
  const cleanSelectedText = selectedText.trim();

  if (!cleanSelectedText || content.includes(`~~${cleanSelectedText}~~`)) {
    return null;
  }

  const selectionIndex = content.indexOf(cleanSelectedText);
  if (selectionIndex < 0) {
    return null;
  }

  return (
    content.slice(0, selectionIndex) +
    `~~${cleanSelectedText}~~` +
    content.slice(selectionIndex + cleanSelectedText.length)
  );
}

function removeStrikethroughFromContent(
  content: string,
  selectedText: string,
): string | null {
  const cleanSelectedText = selectedText.trim();

  if (!cleanSelectedText) {
    return null;
  }

  const strikethroughText = `~~${cleanSelectedText}~~`;
  const selectionIndex = content.indexOf(strikethroughText);

  if (selectionIndex < 0) {
    return null;
  }

  return (
    content.slice(0, selectionIndex) +
    cleanSelectedText +
    content.slice(selectionIndex + strikethroughText.length)
  );
}

export default function App() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsDataSizeBytes, setProjectsDataSizeBytes] = useState(0);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [projectToDelete, setProjectToDelete] =
    useState<ProjectSummary | null>(null);
  const [theme, setTheme] = useState<AppTheme>("dark");
  const projectsImportInputRef = useRef<HTMLInputElement | null>(null);
  const { messages, addToast, dismissToast } = useToast();

  const loadProjects = useCallback(async () => {
    setIsProjectsLoading(true);
    const summaries = await getProjectSummaries();
    const projectsData = await getAllProjectsData();
    const storedSelectedProjectId = readStoredSelectedProjectId();

    if (
      storedSelectedProjectId &&
      summaries.some((project) => project.id === storedSelectedProjectId)
    ) {
      setSelectedProjectId(storedSelectedProjectId);
    } else if (storedSelectedProjectId) {
      window.localStorage.removeItem(STORAGE_KEYS.selectedProjectId);
    }

    setProjects(summaries);
    setProjectsDataSizeBytes(
      new Blob([
        JSON.stringify({
          projects: projectsData,
        }),
      ]).size,
    );
    setIsProjectsLoading(false);
  }, []);

  useEffect(() => {
    setTheme(readStoredTheme());
    void loadProjects();
  }, [loadProjects]);

  const handleCreateProject = async (name: string) => {
    await createProject(name);
    await loadProjects();
    addToast("Projeto criado com sucesso");
  };

  const handleRenameProject = async (projectId: string, name: string) => {
    await renameProject(projectId, name);
    await loadProjects();
    addToast("Projeto renomeado");
  };

  const handleExportProject = async (projectId: string) => {
    const data = await getProjectData(projectId);
    if (!data) {
      addToast("Projeto nao encontrado", "error");
      return;
    }

    const backupText = createCompleteBackupText([data]);
    downloadTextFile(`${data.project.name}-backup.txt`, backupText);
    addToast(`Backup do projeto "${data.project.name}" exportado`);
  };

  const handleExportAll = async () => {
    const data = await getAllProjectsData();
    const backupText = createCompleteBackupText(data);
    downloadTextFile("organizar-markdown-projetos-backup.txt", backupText);
    addToast(`Backup completo exportado com ${data.length} projeto(s)`);
  };

  const handleImportProjectsClick = () => {
    projectsImportInputRef.current?.click();
  };

  const handleImportProjectsFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const rawText = await readTextFile(file);
      const importedBackup = parseProjectsBackupFile(rawText);
      const createdProjects = await importProjectsBackup(
        importedBackup.projects,
      );
      await loadProjects();
      addToast(`${createdProjects.length} projeto(s) importado(s) com sucesso`);
    } catch {
      addToast("Nao foi possivel importar este arquivo.", "error");
    } finally {
      event.target.value = "";
    }
  };

  const executeDeleteProject = async () => {
    if (!projectToDelete) {
      return;
    }
    await deleteProject(projectToDelete.id);
    setProjectToDelete(null);
    await loadProjects();
    addToast("Projeto removido", "info");
  };

  const handleOpenProject = (projectId: string) => {
    window.localStorage.setItem(STORAGE_KEYS.selectedProjectId, projectId);
    setSelectedProjectId(projectId);
  };

  const selectedProject = selectedProjectId
    ? projects.find((project) => project.id === selectedProjectId)
    : null;

  if (selectedProject) {
    return (
      <ProjectWorkspace
        key={selectedProject.id}
        project={selectedProject}
        onBackToProjects={() => {
          setTheme(readStoredTheme());
          window.localStorage.removeItem(STORAGE_KEYS.selectedProjectId);
          setSelectedProjectId(null);
          void loadProjects();
        }}
      />
    );
  }

  return (
    <>
      <ProjectsHome
        projects={projects}
        isLoading={isProjectsLoading}
        theme={theme}
        storedDataSizeBytes={projectsDataSizeBytes}
        onCreateProject={handleCreateProject}
        onOpenProject={handleOpenProject}
        onRenameProject={handleRenameProject}
        onDeleteProject={setProjectToDelete}
        onExportProject={(projectId) => {
          void handleExportProject(projectId);
        }}
        onExportAll={() => {
          void handleExportAll();
        }}
        onImportAll={handleImportProjectsClick}
      />

      <input
        ref={projectsImportInputRef}
        type="file"
        accept=".txt,.json,text/plain,application/json"
        className="hidden"
        onChange={(event) => {
          void handleImportProjectsFile(event);
        }}
      />

      <ConfirmModal
        open={projectToDelete !== null}
        title="Excluir projeto"
        description={`Deseja excluir o projeto "${projectToDelete?.name ?? ""}" e todos os dados dele? Essa acao nao pode ser desfeita.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        theme={theme}
        onConfirm={() => {
          void executeDeleteProject();
        }}
        onCancel={() => setProjectToDelete(null)}
      />

      <ToastContainer
        messages={messages}
        theme={theme}
        onDismiss={dismissToast}
      />
    </>
  );
}

interface ProjectWorkspaceProps {
  project: Project;
  onBackToProjects: () => void;
}

function ProjectWorkspace({
  project,
  onBackToProjects,
}: ProjectWorkspaceProps) {
  const [workspaceProject, setWorkspaceProject] = useState(project);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<MarkdownItem | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [isScrollSyncEnabled, setIsScrollSyncEnabled] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("normal");
  const [isDiagramSidebarVisible, setIsDiagramSidebarVisible] = useState(true);
  const [diagramEdgeStyle, setDiagramEdgeStyle] =
    useState<DiagramEdgeStyle>("curve");
  const [databaseEdgeStyle, setDatabaseEdgeStyle] =
    useState<DiagramEdgeStyle>("square");
  const [hiddenDiagramItemIds, setHiddenDiagramItemIds] = useState<Set<string>>(
    () => new Set(project.hiddenDiagramItemIds ?? []),
  );
  const [fontScale, setFontScale] = useState(FONT_SCALE.default);
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(false);
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [arePreferencesLoaded, setArePreferencesLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const diagramStateRef = useRef<DiagramState | null>(
    project.diagramState ?? null,
  );
  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const syncSourceRef = useRef<"left" | "right" | null>(null);
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
  } = useMarkdownBoard(project.id);
  const [diagramResetSignal, setDiagramResetSignal] = useState(0);
  const [diagramClearEdgesSignal, setDiagramClearEdgesSignal] = useState(0);
  const [diagramReloadStateSignal, setDiagramReloadStateSignal] = useState(0);
  const { messages, addToast, dismissToast } = useToast();
  const {
    databaseDiagram,
    databaseParseResult,
    databaseResetSignal,
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

  useEffect(() => {
    setIsCompactMode(readStoredCompactMode());
  }, []);

  useEffect(() => {
    setViewMode(readStoredViewMode());
  }, []);

  useEffect(() => {
    setFontScale(readStoredFontScale());
  }, []);

  useEffect(() => {
    setIsPreviewMaximized(readStoredPreviewMaximized());
  }, []);

  useEffect(() => {
    setTheme(readStoredTheme());
    setDiagramEdgeStyle(readStoredDiagramEdgeStyle());
    setDatabaseEdgeStyle(readStoredDatabaseEdgeStyle());
    setArePreferencesLoaded(true);
  }, []);

  useEffect(() => {
    if (!arePreferencesLoaded) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEYS.compactMode,
      String(isCompactMode),
    );
  }, [arePreferencesLoaded, isCompactMode]);

  useEffect(() => {
    if (!arePreferencesLoaded) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.fontScale, String(fontScale));
  }, [arePreferencesLoaded, fontScale]);

  useEffect(() => {
    if (!arePreferencesLoaded) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.viewMode, viewMode);
  }, [arePreferencesLoaded, viewMode]);

  useEffect(() => {
    if (!arePreferencesLoaded) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEYS.previewMaximized,
      String(isPreviewMaximized),
    );
  }, [arePreferencesLoaded, isPreviewMaximized]);

  useEffect(() => {
    if (!arePreferencesLoaded) {
      return;
    }

    window.localStorage.setItem(STORAGE_KEYS.theme, theme);
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
  }, [arePreferencesLoaded, theme]);

  useEffect(() => {
    if (!arePreferencesLoaded) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEYS.diagramEdgeStyle,
      diagramEdgeStyle,
    );
  }, [arePreferencesLoaded, diagramEdgeStyle]);

  useEffect(() => {
    if (!arePreferencesLoaded) {
      return;
    }

    window.localStorage.setItem(
      STORAGE_KEYS.databaseEdgeStyle,
      databaseEdgeStyle,
    );
  }, [arePreferencesLoaded, databaseEdgeStyle]);

  useEffect(() => {
    if (!arePreferencesLoaded) {
      return;
    }

    const nextHiddenItemIds = [...hiddenDiagramItemIds];
    setWorkspaceProject((current) => ({
      ...current,
      hiddenDiagramItemIds: nextHiddenItemIds,
    }));
    void updateProjectHiddenDiagramItemIds(project.id, nextHiddenItemIds);
  }, [arePreferencesLoaded, hiddenDiagramItemIds, project.id]);

  useEffect(() => {
    if (items.length === 0) {
      setActiveItemId(null);
      if (!isLoading) {
        setHiddenDiagramItemIds(new Set());
      }
      return;
    }

    if (!activeItemId || !items.some((item) => item.id === activeItemId)) {
      setActiveItemId(items[0].id);
    }
  }, [activeItemId, isLoading, items]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const validIds = new Set(items.map((item) => item.id));
    setHiddenDiagramItemIds((current) => {
      const next = new Set(
        [...current].filter((itemId) => validIds.has(itemId)),
      );
      return next.size === current.size ? current : next;
    });
  }, [isLoading, items]);

  useEffect(() => {
    if (
      !isScrollSyncEnabled ||
      isPreviewMaximized ||
      viewMode === "cards" ||
      viewMode === "diagram" ||
      viewMode === "database"
    ) {
      syncSourceRef.current = null;
      return;
    }

    const leftElement = leftScrollRef.current;
    const rightElement = rightScrollRef.current;

    if (!leftElement || !rightElement) {
      return;
    }

    const syncScroll = (
      source: HTMLDivElement,
      target: HTMLDivElement,
      sourceName: "left" | "right",
    ) => {
      if (syncSourceRef.current && syncSourceRef.current !== sourceName) {
        return;
      }

      syncSourceRef.current = sourceName;

      const maxSourceScroll = source.scrollHeight - source.clientHeight;
      const maxTargetScroll = target.scrollHeight - target.clientHeight;
      const ratio =
        maxSourceScroll > 0 ? source.scrollTop / maxSourceScroll : 0;
      target.scrollTop = maxTargetScroll > 0 ? ratio * maxTargetScroll : 0;

      window.requestAnimationFrame(() => {
        syncSourceRef.current = null;
      });
    };

    const handleLeftScroll = () =>
      syncScroll(leftElement, rightElement, "left");
    const handleRightScroll = () =>
      syncScroll(rightElement, leftElement, "right");

    leftElement.addEventListener("scroll", handleLeftScroll, { passive: true });
    rightElement.addEventListener("scroll", handleRightScroll, {
      passive: true,
    });

    return () => {
      leftElement.removeEventListener("scroll", handleLeftScroll);
      rightElement.removeEventListener("scroll", handleRightScroll);
    };
  }, [isPreviewMaximized, isScrollSyncEnabled, items.length, viewMode]);

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
    diagramStateRef.current = EMPTY_DIAGRAM_STATE;
    setHiddenDiagramItemIds(new Set());
    setWorkspaceProject((current) => ({
      ...current,
      diagramState: EMPTY_DIAGRAM_STATE,
      hiddenDiagramItemIds: [],
    }));
    await updateProjectDiagramState(project.id, EMPTY_DIAGRAM_STATE);
    await clearItems();
    await resetDatabaseDiagramToDefault();
    addToast(
      "Dados removidos e banco restaurado para o exemplo inicial",
      "info",
      {
        label: "Desfazer",
        onClick: () => {
          void replaceItems(snapshot);
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
    void updateProjectDiagramState(project.id, state);
  }, [project.id]);

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
      await replaceItems(importedBackup.items);
      const nextDiagramState =
        importedBackup.diagramState ?? EMPTY_DIAGRAM_STATE;
      const nextHiddenItemIds = importedBackup.hiddenDiagramItemIds ?? [];
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

  const handleSelectItem = (item: MarkdownItem) => {
    setActiveItemId(item.id);
    document.getElementById(`preview-item-${item.id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleStrikePreviewSelection = useCallback(async () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString() ?? "";

    if (!selection || selectedText.trim().length === 0) {
      addToast("Selecione um texto no preview para riscar", "error");
      return;
    }

    const selectedItemId = getSelectionPreviewItemId(selection);
    const selectedItem = items.find((item) => item.id === selectedItemId);

    if (!selectedItem) {
      addToast("Selecione um texto dentro de um card do preview", "error");
      return;
    }

    const nextContent = addStrikethroughToContent(
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
    addToast("Texto riscado no card");
  }, [addToast, items, updateItem]);

  const handleUnstrikePreviewSelection = useCallback(async () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString() ?? "";

    if (!selection || selectedText.trim().length === 0) {
      addToast("Selecione um texto riscado no preview", "error");
      return;
    }

    const selectedItemId = getSelectionPreviewItemId(selection);
    const selectedItem = items.find((item) => item.id === selectedItemId);

    if (!selectedItem) {
      addToast("Selecione um texto dentro de um card do preview", "error");
      return;
    }

    const nextContent = removeStrikethroughFromContent(
      selectedItem.content,
      selectedText,
    );

    if (!nextContent) {
      addToast("Esse texto selecionado nao esta riscado no markdown", "error");
      return;
    }

    await updateItem(selectedItem.id, nextContent, selectedItem.title);
    selection.removeAllRanges();
    setActiveItemId(selectedItem.id);
    addToast("Texto desriscado no card");
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
    });
  }, [addToast, resetDatabaseDiagramToDefault]);

  const handleSelectDiagramItem = (item: MarkdownItem) => {
    setActiveItemId(item.id);
  };

  const handleToggleDiagramItemVisibility = (itemId: string) => {
    setHiddenDiagramItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
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

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,text/plain,application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      <AppShell
        itemsCount={items.length}
        isCompactMode={isCompactMode}
        isPreviewMaximized={isPreviewMaximized}
        isDiagramSidebarVisible={isDiagramSidebarVisible}
        diagramEdgeStyle={diagramEdgeStyle}
        databaseEdgeStyle={databaseEdgeStyle}
        viewMode={viewMode}
        isScrollSyncEnabled={isScrollSyncEnabled}
        theme={theme}
        fontScale={fontScale}
        onOpenModal={() => setIsModalOpen(true)}
        onToggleCompactMode={() => setIsCompactMode((current) => !current)}
        onTogglePreviewMaximized={() =>
          setIsPreviewMaximized((current) => !current)
        }
        onToggleDiagramSidebar={() =>
          setIsDiagramSidebarVisible((current) => !current)
        }
        onSetDiagramEdgeStyle={setDiagramEdgeStyle}
        onSetDatabaseEdgeStyle={setDatabaseEdgeStyle}
        onSetViewMode={handleSetViewMode}
        onResetDiagramLayout={handleResetDiagramLayout}
        onResetDatabaseLayout={handleResetDatabaseLayout}
        databaseInfo={
          viewMode === "database"
            ? {
                tables: databaseParseResult.tables.length,
                relations: databaseParseResult.relations.length,
                errors: databaseParseResult.errors.length,
              }
            : undefined
        }
        projectName={workspaceProject.name}
        storedDataSizeBytes={storedDataSizeBytes}
        onBackToProjects={onBackToProjects}
        onToggleScrollSync={() => setIsScrollSyncEnabled((current) => !current)}
        onToggleTheme={() =>
          setTheme((current) => (current === "dark" ? "light" : "dark"))
        }
        onClearAll={handleClearAll}
        onDecreaseFont={() =>
          setFontScale((current) => clampFontScale(current - FONT_SCALE.step))
        }
        onIncreaseFont={() =>
          setFontScale((current) => clampFontScale(current + FONT_SCALE.step))
        }
        onExport={() => {
          void handleExport();
        }}
        onImport={handleImportClick}
        onCopyAll={() => {
          void handleCopyAll();
        }}
        isMac={isMac}
        leftPanel={
          viewMode === "database" ? (
            <DbmlEditor
              value={databaseDiagram?.content ?? ""}
              theme={theme}
              onChange={onDatabaseContentChange}
              errors={databaseParseResult.errors}
            />
          ) : viewMode === "diagram" ? (
            <DiagramSidebar
              items={items}
              theme={theme}
              activeItemId={activeItemId}
              hiddenItemIds={hiddenDiagramItemIds}
              onSelectItem={handleSelectDiagramItem}
              onToggleItemVisibility={handleToggleDiagramItemVisibility}
              onChangeStatus={(itemId, status) => {
                void updateItemStatus(itemId, status);
              }}
              onChangeObservation={(itemId, observation) => {
                void updateItemObservation(itemId, observation);
              }}
              onResetLayout={handleResetDiagramLayout}
              onClearEdges={handleClearDiagramEdges}
            />
          ) : (
            <SortableCardsPanel
              items={items}
              isLoading={isLoading}
              isOutlineMode={viewMode === "index"}
              activeItemId={activeItemId}
              scrollContainerRef={leftScrollRef}
              theme={theme}
              onReorder={reorderItems}
              onSelect={handleSelectItem}
              onEdit={(item) => {
                setEditingItem(item);
                setIsModalOpen(true);
              }}
              onDelete={(item) => {
                void handleDeleteItem(item);
              }}
              onChangeStatus={(itemId, status) => {
                void updateItemStatus(itemId, status);
              }}
            />
          )
        }
        rightPanel={
          viewMode === "database" ? (
            <DatabaseDiagramPanel
              tables={databaseParseResult.tables}
              relations={databaseParseResult.relations}
              theme={theme}
              state={databaseDiagram?.state ?? { positions: {} }}
              onStateChange={onDatabaseStateChange}
              onRenameTable={onRenameDatabaseTable}
              onRenameColumn={onRenameDatabaseColumn}
              edgeStyle={databaseEdgeStyle}
              resetSignal={databaseResetSignal}
            />
          ) : viewMode === "diagram" ? (
            <DiagramPanel
              items={items}
              theme={theme}
              activeItemId={activeItemId}
              hiddenItemIds={hiddenDiagramItemIds}
              edgeStyle={diagramEdgeStyle}
              onSelectItem={handleSelectDiagramItem}
              onChangeStatus={(itemId, status) => {
                void updateItemStatus(itemId, status);
              }}
              scrollContainerRef={rightScrollRef}
              resetLayoutSignal={diagramResetSignal}
              clearEdgesSignal={diagramClearEdgesSignal}
              reloadStateSignal={diagramReloadStateSignal}
              initialState={workspaceProject.diagramState ?? EMPTY_DIAGRAM_STATE}
              onDiagramStateChange={handleDiagramStateChange}
            />
          ) : (
            <CombinedOutputPanel
              items={items}
              isLoading={isLoading}
              theme={theme}
              viewMode={viewMode}
              activeItemId={activeItemId}
              scrollContainerRef={rightScrollRef}
              onSelect={handleSelectItem}
              onReorder={reorderItems}
              onStrikeSelection={() => {
                void handleStrikePreviewSelection();
              }}
              onUnstrikeSelection={() => {
                void handleUnstrikePreviewSelection();
              }}
              onChangeStatus={(itemId, status) => {
                void updateItemStatus(itemId, status);
              }}
            />
          )
        }
      />

      <AddMarkdownModal
        open={isModalOpen}
        isSaving={isSaving}
        mode={editingItem ? "edit" : "create"}
        initialValue={editingItem?.content ?? ""}
        initialTitle={editingItem?.title ?? ""}
        theme={theme}
        isMac={isMac}
        onClose={() => {
          if (!isSaving) {
            setIsModalOpen(false);
            setEditingItem(null);
          }
        }}
        onSave={handleSave}
      />

      <ConfirmModal
        open={confirmClearAll}
        title="Remover todos os cards"
        description="Deseja remover todos os cards salvos? Essa acao nao pode ser desfeita."
        confirmLabel="Remover tudo"
        cancelLabel="Cancelar"
        variant="danger"
        theme={theme}
        onConfirm={() => {
          void executeClearAll();
        }}
        onCancel={() => setConfirmClearAll(false)}
      />

      <ConfirmModal
        open={deletingItem !== null}
        title="Remover card"
        description={`Deseja remover o card "${deletingItem ? getDisplayTitle(deletingItem, 40) : ""}"?`}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        variant="danger"
        theme={theme}
        onConfirm={() => {
          void executeDeleteItem();
        }}
        onCancel={() => setDeletingItem(null)}
      />

      <ToastContainer
        messages={messages}
        theme={theme}
        onDismiss={dismissToast}
      />
    </>
  );
}
