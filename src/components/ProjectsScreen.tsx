"use client";
import { useProjects } from "../hooks/useProjects";

import { ConfirmModal } from "../components/ConfirmModal";
import { ProjectsHome } from "../components/ProjectsHome";
import { ToastContainer } from "../components/Toast";

import {
  STORAGE_KEYS
} from "../lib/preferences";

import { ProjectWorkspace } from "./ProjectWorkspace";
export function ProjectsScreen() {
  const {
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
    reportActionError,
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
  } = useProjects();
  if (isProjectsLoading) {
    // Sem data-theme próprio de propósito: o HTML do servidor não conhece o
    // tema salvo (localStorage só existe no browser) e renderizar "dark" aqui
    // pintava a tela de preto no primeiro paint mesmo em modo light. Sem o
    // atributo, a tela herda as variáveis do <html>, que o script anti-FOUC
    // do layout já marca com o tema certo antes do primeiro paint.
    return (
      <main className="nexo-ui flex min-h-screen items-center justify-center">
        <div
          role="status"
          className="nexo-loading flex items-center gap-3 text-sm text-[var(--ui-muted)]"
        >
          Carregando...
        </div>
      </main>
    );
  }

  if (loadError) {
    return <main className="nexo-ui flex min-h-screen flex-col items-center justify-center gap-4" data-theme={theme}>
      <p role="alert">{loadError}</p>
      <button type="button" className="toolbar-button" onClick={() => void loadProjects()}>
        Tentar novamente
      </button>
    </main>;
  }

  if (selectedProject) {
    return (
      <ProjectWorkspace
        key={selectedProject.id}
        project={selectedProject}
        onBackToProjects={() => {
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
          void handleExportProject(projectId).catch(reportActionError);
        }}
        onExportAll={() => {
          void handleExportAll().catch(reportActionError);
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
          void executeDeleteProject().catch(reportActionError);
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
