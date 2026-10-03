"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePreferences } from "../contexts/PreferencesContext";
import { useToast } from "../hooks/useToast";
import {
  createCompleteBackupText,
  parseProjectsBackupFile
} from "../lib/backup";
import {
  readStoredSelectedProjectId,
  STORAGE_KEYS
} from "../lib/preferences";
import {
  createProject,
  deleteProject,
  getAllProjectsData,
  getProjectData,
  getProjectSummaries,
  importProjectsBackup,
  renameProject,
  type ProjectSummary
} from "../lib/projects";
import { downloadTextFile, readTextFile } from "../lib/textFiles";
export function useProjects() {
  const loadRequestRef = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectsDataSizeBytes, setProjectsDataSizeBytes] = useState(0);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [projectToDelete, setProjectToDelete] =
    useState<ProjectSummary | null>(null);
  const { theme } = usePreferences();
  const projectsImportInputRef = useRef<HTMLInputElement | null>(null);
  const { messages, addToast, dismissToast } = useToast();

  const loadProjects = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setIsProjectsLoading(true);
    setLoadError(null);
    try {
      const summaries = await getProjectSummaries();
      const projectsData = await getAllProjectsData();
      if (requestId !== loadRequestRef.current) return;
      const storedSelectedProjectId = readStoredSelectedProjectId();
      const selected = summaries.some((project) => project.id === storedSelectedProjectId)
        ? storedSelectedProjectId : null;
      setSelectedProjectId(selected);
      if (storedSelectedProjectId && !selected) {
        window.localStorage.removeItem(STORAGE_KEYS.selectedProjectId);
      }
      setProjects(summaries);
      setProjectsDataSizeBytes(new Blob([JSON.stringify({ projects: projectsData })]).size);
    } catch {
      if (requestId === loadRequestRef.current) {
        setLoadError("Não foi possível carregar os projetos. Tente novamente.");
      }
    } finally {
      if (requestId === loadRequestRef.current) setIsProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
    return () => { loadRequestRef.current += 1; };
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

  return {
    loadError,
    projects,
    projectsDataSizeBytes,
    isProjectsLoading,
    selectedProjectId,
    setSelectedProjectId,
    projectToDelete,
    setProjectToDelete,
    theme,
    projectsImportInputRef,
    messages,
    dismissToast,
    loadProjects,
    handleCreateProject,
    handleRenameProject,
    handleExportProject,
    handleExportAll,
    handleImportProjectsClick,
    handleImportProjectsFile,
    executeDeleteProject,
    handleOpenProject,
    selectedProject,
  };
}
