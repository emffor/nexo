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

function findStrikethroughRange(
  content: string,
  selectionIndex: number,
): { start: number; end: number; textStart: number; textEnd: number } | null {
  return (
    findStrikethroughRanges(content).find(
      (range) =>
        selectionIndex >= range.textStart && selectionIndex < range.textEnd,
    ) ?? null
  );
}

function findStrikethroughRanges(
  content: string,
): Array<{ start: number; end: number; textStart: number; textEnd: number }> {
  const markerPattern = /~~([\s\S]*?)~~/g;
  let match: RegExpExecArray | null;
  const ranges: Array<{
    start: number;
    end: number;
    textStart: number;
    textEnd: number;
  }> = [];

  while ((match = markerPattern.exec(content)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    const textStart = start + 2;
    const textEnd = end - 2;

    ranges.push({ start, end, textStart, textEnd });
  }

  return ranges;
}

function buildStrikethroughPart(value: string): string {
  const content = value.trim();

  if (!content) {
    return value;
  }

  const leadingSpace = value.match(/^\s*/)?.[0] ?? "";
  const trailingSpace = value.match(/\s*$/)?.[0] ?? "";

  return `${leadingSpace}~~${content}~~${trailingSpace}`;
}

function findTextIgnoringStrikethroughMarkers(
  content: string,
  selectedText: string,
): { start: number; end: number } | null {
  const cleanSelectedText = selectedText.trim();

  if (!cleanSelectedText) {
    return null;
  }

  let plainContent = "";
  const markdownIndexByPlainIndex: number[] = [];

  for (let index = 0; index < content.length; index += 1) {
    if (content.slice(index, index + 2) === "~~") {
      index += 1;
      continue;
    }

    markdownIndexByPlainIndex.push(index);
    plainContent += content[index];
  }

  const plainSelectionIndex = plainContent.indexOf(cleanSelectedText);

  if (plainSelectionIndex < 0) {
    return null;
  }

  const plainSelectionEnd = plainSelectionIndex + cleanSelectedText.length - 1;
  const start = markdownIndexByPlainIndex[plainSelectionIndex];
  const end = markdownIndexByPlainIndex[plainSelectionEnd] + 1;

  return typeof start === "number" && typeof end === "number"
    ? { start, end }
    : null;
}

function isRangeFullyStruck(content: string, start: number, end: number) {
  const ranges = findStrikethroughRanges(content);
  let hasText = false;

  for (let index = start; index < end; index += 1) {
    if (content.slice(index, index + 2) === "~~") {
      index += 1;
      continue;
    }

    if (!content[index] || content[index].trim() === "") {
      continue;
    }

    hasText = true;

    const isInsideStrikethrough = ranges.some(
      (range) => index >= range.textStart && index < range.textEnd,
    );

    if (!isInsideStrikethrough) {
      return false;
    }
  }

  return hasText;
}

function toggleStrikethroughInContent(
  content: string,
  selectedText: string,
): string | null {
  const cleanSelectedText = selectedText.trim();

  if (!cleanSelectedText) {
    return null;
  }

  const selectionRange = findTextIgnoringStrikethroughMarkers(
    content,
    cleanSelectedText,
  );

  if (!selectionRange) {
    return null;
  }

  const selectedMarkdownText = content.slice(
    selectionRange.start,
    selectionRange.end,
  );
  const selectedMarkdownTextWithoutMarkers = selectedMarkdownText.replace(
    /~~/g,
    "",
  );
  const isSelectionFullyStruck = isRangeFullyStruck(
    content,
    selectionRange.start,
    selectionRange.end,
  );
  const strikethroughRange = findStrikethroughRange(
    content,
    selectionRange.start,
  );

  if (!isSelectionFullyStruck) {
    return (
      content.slice(0, selectionRange.start) +
      `~~${selectedMarkdownTextWithoutMarkers}~~` +
      content.slice(selectionRange.end)
    );
  }

  if (!strikethroughRange && selectedMarkdownText.includes("~~")) {
    return (
      content.slice(0, selectionRange.start) +
      selectedMarkdownTextWithoutMarkers +
      content.slice(selectionRange.end)
    );
  }

  if (!strikethroughRange) {
    return null;
  }

  const strikethroughText = content.slice(
    strikethroughRange.textStart,
    strikethroughRange.textEnd,
  );
  const relativeSelectionIndex =
    selectionRange.start - strikethroughRange.textStart;
  const beforeSelection = strikethroughText.slice(0, relativeSelectionIndex);
  const afterSelection = strikethroughText.slice(
    relativeSelectionIndex + cleanSelectedText.length,
  );
  const nextParts = [
    beforeSelection ? buildStrikethroughPart(beforeSelection) : "",
    cleanSelectedText,
    afterSelection ? buildStrikethroughPart(afterSelection) : "",
  ];

  return (
    content.slice(0, strikethroughRange.start) +
    nextParts.join("") +
    content.slice(strikethroughRange.end)
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
  const [theme, setTheme] = useState<AppTheme>(() => readStoredTheme());
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
    } catch (err) {
      console.error("Erro ao importar backup:", err);
      const msg = err instanceof Error ? err.message : "Nao foi possivel importar este arquivo.";
      addToast(msg, "error");
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

  if (isProjectsLoading) {
    return (
      <main
        data-theme={theme}
        suppressHydrationWarning
        className="nexo-ui flex min-h-screen items-center justify-center"
      >
        <div
          role="status"
          className="nexo-loading flex items-center gap-3 text-sm text-[var(--ui-muted)]"
        >
          Carregando...
        </div>
      </main>
    );
  }

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
  const [viewMode, setViewMode] = useState<ViewMode>(() =>
    readStoredViewMode(),
  );
  const [isDiagramSidebarVisible, setIsDiagramSidebarVisible] = useState(true);
  const [diagramEdgeStyle, setDiagramEdgeStyle] =
    useState<DiagramEdgeStyle>(() => readStoredDiagramEdgeStyle());
  const [databaseEdgeStyle, setDatabaseEdgeStyle] =
    useState<DiagramEdgeStyle>(() => readStoredDatabaseEdgeStyle());
  const [hiddenDiagramItemIds, setHiddenDiagramItemIds] = useState<Set<string>>(
    () => new Set(project.hiddenDiagramItemIds ?? []),
  );
  const [fontScale, setFontScale] = useState(() => readStoredFontScale());
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(
    () => readStoredPreviewMaximized(),
  );
  const [theme, setTheme] = useState<AppTheme>(() => readStoredTheme());
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

  const isFirstHiddenPersistRef = useRef(true);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.fontScale, String(fontScale));
  }, [fontScale]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.viewMode, viewMode);
  }, [viewMode]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEYS.previewMaximized,
      String(isPreviewMaximized),
    );
  }, [isPreviewMaximized]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.theme, theme);
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    document.body.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEYS.diagramEdgeStyle,
      diagramEdgeStyle,
    );
  }, [diagramEdgeStyle]);

  useEffect(() => {
    window.localStorage.setItem(
      STORAGE_KEYS.databaseEdgeStyle,
      databaseEdgeStyle,
    );
  }, [databaseEdgeStyle]);

  useEffect(() => {
    if (isFirstHiddenPersistRef.current) {
      isFirstHiddenPersistRef.current = false;
      return;
    }

    const nextHiddenItemIds = [...hiddenDiagramItemIds];
    setWorkspaceProject((current) => ({
      ...current,
      hiddenDiagramItemIds: nextHiddenItemIds,
    }));
    void updateProjectHiddenDiagramItemIds(project.id, nextHiddenItemIds);
  }, [hiddenDiagramItemIds, project.id]);

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
  };

  const handleSelectItemFromList = (item: MarkdownItem) => {
    setActiveItemId(item.id);

    if (viewMode !== "index") {
      return;
    }

    document.getElementById(`preview-item-${item.id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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
        isPreviewMaximized={isPreviewMaximized}
        isDiagramSidebarVisible={isDiagramSidebarVisible}
        diagramEdgeStyle={diagramEdgeStyle}
        databaseEdgeStyle={databaseEdgeStyle}
        viewMode={viewMode}
        isScrollSyncEnabled={isScrollSyncEnabled}
        theme={theme}
        fontScale={fontScale}
        onOpenModal={() => setIsModalOpen(true)}
        onTogglePreviewMaximized={() =>
          setIsPreviewMaximized((current) => !current)
        }
        isSidebarToggleVisible={
          viewMode === "normal" ||
          viewMode === "index" ||
          viewMode === "diagram"
        }
        isSidebarHidden={isPreviewMaximized}
        isStrikethroughVisible={
          items.length > 0 &&
          (viewMode === "normal" ||
            viewMode === "index" ||
            viewMode === "cards")
        }
        onToggleStrikethrough={() => {
          void handleTogglePreviewStrikethrough();
        }}
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
              onSelect={handleSelectItemFromList}
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
