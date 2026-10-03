"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { NexoLogo } from "./NexoLogo";
import type { AppTheme } from "../lib/preferences";
import type { ProjectSummary } from "../lib/projects";

interface ProjectsHomeProps {
  projects: ProjectSummary[];
  isLoading: boolean;
  theme: AppTheme;
  storedDataSizeBytes: number;
  onCreateProject: (name: string) => Promise<void>;
  onOpenProject: (projectId: string) => void;
  onRenameProject: (projectId: string, name: string) => Promise<void>;
  onDeleteProject: (project: ProjectSummary) => void;
  onExportProject: (projectId: string) => void;
  onExportAll: () => void;
  onImportAll: () => void;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function formatStorageSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${(bytes / 1024).toFixed(2)} KB`;
}

export function ProjectsHome({
  projects,
  isLoading,
  theme,
  storedDataSizeBytes,
  onCreateProject,
  onOpenProject,
  onRenameProject,
  onDeleteProject,
  onExportProject,
  onExportAll,
  onImportAll,
}: ProjectsHomeProps) {
  const [newProjectName, setNewProjectName] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [search, setSearch] = useState("");
  const [pendingAction, setPendingAction] = useState<"create" | "rename" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredProjects = projects.filter((project) =>
    project.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
  );

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingAction || !newProjectName.trim()) return;
    setPendingAction("create");
    setFormError(null);
    try {
      await onCreateProject(newProjectName.trim());
      setNewProjectName("");
    } catch {
      setFormError("Não foi possível criar o projeto. Tente novamente.");
    } finally {
      setPendingAction(null);
    }
  };

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingProjectId || pendingAction || !editingName.trim()) {
      return;
    }
    setPendingAction("rename");
    setFormError(null);
    try {
      await onRenameProject(editingProjectId, editingName.trim());
      setEditingProjectId(null);
      setEditingName("");
    } catch {
      setFormError("Não foi possível renomear o projeto. Tente novamente.");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <main
      data-theme={theme}
      suppressHydrationWarning
      className="nexo-ui nexo-app-frame nexo-projects-home min-h-screen"
    >
      <header
        className="nexo-topbar border-b px-5 py-3 sm:px-8 border-[var(--ui-line)]"
      >
        <div className="mx-auto flex min-h-[47px] max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <NexoLogo theme={theme} width={28} height={24} className="nexo-brand-mark" />
            <span
              className="font-semibold text-sm tracking-tight text-[var(--ui-heading)]"
            >
              Nexo
            </span>
            <span
              className="text-xs text-[var(--ui-muted)]"
            >
              /
            </span>
            <span
              className="text-xs font-medium text-[var(--ui-muted)]"
            >
              Projetos
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="toolbar-badge h-8 px-3 text-xs rounded-full">{formatStorageSize(storedDataSizeBytes)}</span>
            <span className="toolbar-badge h-8 px-3 text-xs rounded-full">{projects.length} {projects.length === 1 ? "projeto" : "projetos"}</span>
            <button type="button" onClick={onImportAll} className="toolbar-button h-8 px-3.5 text-xs rounded-full">Importar</button>
            <button type="button" onClick={onExportAll} disabled={projects.length === 0} className="toolbar-button h-8 px-3.5 text-xs rounded-full">Exportar</button>
          </div>
        </div>
      </header>

      <section className="nexo-projects-content mx-auto w-full max-w-[1600px] px-5 py-6 sm:px-8">
        <div className="nexo-section-heading mb-8 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1
              className="text-2xl font-semibold tracking-tight text-[var(--ui-heading)]"
            >
              Projetos
            </h1>
            <p
              className="mt-2 text-sm text-[var(--ui-muted)]"
            >
              Documentação e diagramas, organizados em um só lugar.
            </p>
          </div>

          <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="new-project-name">
              Nome do projeto
            </label>
            <input
              id="new-project-name"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="Nome do novo projeto"
              required
              disabled={pendingAction !== null || isLoading}
              className="nexo-field w-full min-w-0 rounded-xl border sm:w-72 outline-none transition focus:border-[var(--ui-accent)] focus:ring-2 focus:ring-[var(--ui-accent-soft)] border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-heading)] placeholder:text-[var(--ui-muted)]"
            />
            <button
              type="submit"
              disabled={pendingAction !== null || isLoading || !newProjectName.trim()}
              className="toolbar-button toolbar-button--accent h-9 px-4 rounded-xl shadow-sm"
            >
              <span aria-hidden="true" className="mr-1.5 text-lg leading-none">+</span>
              {pendingAction === "create" ? "Criando..." : "Novo Projeto"}
            </button>
          </form>
        </div>

        {formError ? <p role="alert" className="mb-4 text-sm text-[var(--ui-danger)]">{formError}</p> : null}

        {projects.length > 0 ? (
          <div className="nexo-projects-filter mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-[var(--ui-heading)]">Seus projetos</h2>
              <p role="status" className="text-sm text-[var(--ui-muted)]">
                {filteredProjects.length} de {projects.length} projetos
              </p>
            </div>
            <label className="relative w-full sm:w-72">
              <span className="sr-only">Buscar projetos</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome..." className="nexo-field w-full rounded-xl" />
            </label>
          </div>
        ) : null}

        {isLoading ? (
          <div role="status" className="nexo-loading flex min-h-[200px] items-center justify-center gap-3 text-sm text-[var(--ui-muted)]">
            Carregando projetos...
          </div>
        ) : null}

        {!isLoading && projects.length === 0 ? (
          <div
            className="nexo-empty rounded-2xl border border-dashed px-6 py-12 text-center text-sm border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-muted)]"
          >
            <h2 className="mb-2 font-semibold text-[var(--ui-heading)]">Seu próximo projeto começa aqui</h2>
            <p>Use o campo acima para criar um projeto ou importe um backup.</p>
          </div>
        ) : null}

        {!isLoading && projects.length > 0 && filteredProjects.length === 0 ? (
          <div className="nexo-empty rounded-2xl px-6 py-12 text-center">
            <p>Nenhum projeto encontrado para “{search}”.</p>
            <button type="button" onClick={() => setSearch("")} className="toolbar-button h-8 px-3 rounded-xl mt-4">Limpar busca</button>
          </div>
        ) : null}

        {!isLoading && filteredProjects.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredProjects.map((project) => {
              const isEditing = editingProjectId === project.id;
              return (
                <article
                  key={project.id}
                  className="nexo-surface nexo-project-card flex flex-col justify-between transition-all duration-200 rounded-2xl border-[var(--ui-line)] bg-[var(--ui-surface)] hover:border-[var(--ui-line)] shadow-sm"
                >
                  {isEditing ? (
                    <form onSubmit={handleRename} className="flex flex-col gap-2">
                      <label
                        className="sr-only"
                        htmlFor={`project-name-${project.id}`}
                      >
                        Nome do projeto
                      </label>
                      <input
                        id={`project-name-${project.id}`}
                        autoFocus
                        required
                        disabled={pendingAction !== null}
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        className="nexo-field w-full rounded-xl border outline-none focus:ring-2 focus:ring-[var(--ui-accent-soft)] border-[var(--ui-line)] bg-[var(--ui-surface)] text-[var(--ui-heading)]"
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={pendingAction !== null || !editingName.trim()}
                          className="toolbar-button toolbar-button--accent h-8 px-3 rounded-xl"
                        >
                          {pendingAction === "rename" ? "Salvando..." : "Salvar"}
                        </button>
                        <button
                          type="button"
                          disabled={pendingAction !== null}
                          onClick={() => { setEditingProjectId(null); setFormError(null); }}
                          className="toolbar-button h-8 px-3 rounded-xl"
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenProject(project.id)}
                        className="block w-full rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-accent)]"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <span className="nexo-project-tag">Workspace</span>
                          <span className="nexo-project-count">{project.itemsCount} {project.itemsCount === 1 ? "item" : "itens"}</span>
                        </div>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h2
                            className="m-0 line-clamp-1 text-sm font-semibold text-[var(--ui-heading)]"
                          >
                            {project.name}
                          </h2>

                        </div>
                        <p
                          className="mt-1.5 text-[11px] text-[var(--ui-muted)]"
                        >
                          Modificado em {formatDate(project.updatedAt)}
                        </p>
                      </button>

                      <div
                        className="nexo-project-footer mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-3 border-[var(--ui-line)]"
                      >
                        <button
                          type="button"
                          onClick={() => onOpenProject(project.id)}
                          className="nexo-project-open rounded-lg text-xs font-semibold py-1 px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          Abrir workspace →
                        </button>

                        <div className="flex flex-wrap items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onExportProject(project.id)}
                            className="toolbar-button toolbar-button--quiet h-7 px-2.5 text-xs rounded-lg"
                            title="Exportar JSON deste projeto"
                          >
                            Exportar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setFormError(null);
                              setEditingProjectId(project.id);
                              setEditingName(project.name);
                            }}
                            className="toolbar-button toolbar-button--quiet h-7 px-2.5 text-xs rounded-lg"
                          >
                            Renomear
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProject(project)}
                            className="toolbar-button toolbar-button--quiet toolbar-button--danger h-7 px-2.5 text-xs rounded-lg"
                          >
                            Excluir
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
}
