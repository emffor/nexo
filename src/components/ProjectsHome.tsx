"use client";

import { useState, type FormEvent } from "react";
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
  const isDark = theme === "dark";

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onCreateProject(newProjectName);
    setNewProjectName("");
  };

  const handleRename = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingProjectId) {
      return;
    }
    await onRenameProject(editingProjectId, editingName);
    setEditingProjectId(null);
    setEditingName("");
  };

  return (
    <main
      data-theme={theme}
      className="nexo-ui min-h-screen"
    >
      {/* Cabeçalho principal */}
      <header
        className={`nexo-topbar border-b px-5 py-3 sm:px-8 ${
          isDark ? "border-zinc-800 bg-[#161b22]" : "border-[#e6eff5] bg-white"
        }`}
      >
        <div className="mx-auto flex min-h-[32px] max-w-[1440px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`font-semibold text-sm tracking-tight ${
                isDark ? "text-zinc-100" : "text-[#343c6a]"
              }`}
            >
              Nexo
            </span>
            <span
              className={`text-xs ${
                isDark ? "text-zinc-500" : "text-zinc-400"
              }`}
            >
              /
            </span>
            <span
              className={`text-xs font-medium ${
                isDark ? "text-zinc-400" : "text-zinc-600"
              }`}
            >
              Workspaces
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="toolbar-badge">
              {formatStorageSize(storedDataSizeBytes)}
            </span>
            <button
              type="button"
              onClick={onImportAll}
              className="toolbar-button"
            >
              Importar
            </button>
            <button
              type="button"
              onClick={onExportAll}
              disabled={projects.length === 0}
              className="toolbar-button"
            >
              Exportar
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo central */}
      <section className="mx-auto max-w-[1440px] px-5 py-6 sm:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1
              className={`text-xl font-semibold tracking-tight ${
                isDark ? "text-zinc-100" : "text-[#343c6a]"
              }`}
            >
              Projetos
            </h1>
            <p
              className={`mt-0.5 text-xs ${
                isDark ? "text-zinc-400" : "text-zinc-600"
              }`}
            >
              Gerencie seus workspaces de documentação e diagramas.
            </p>
          </div>

          {/* Criação de projeto compacta */}
          <form onSubmit={handleCreate} className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="new-project-name">
              Nome do projeto
            </label>
            <input
              id="new-project-name"
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="Criar novo workspace..."
              className={`nexo-field w-full min-w-0 rounded border sm:w-64 outline-none transition focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 ${
                isDark
                  ? "border-zinc-700 bg-zinc-900 text-zinc-100 placeholder:text-zinc-500"
                  : "border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400"
              }`}
            />
            <button
              type="submit"
              className="toolbar-button toolbar-button--accent"
            >
              Novo Projeto
            </button>
          </form>
        </div>

        {isLoading ? (
          <div className="flex min-h-[200px] items-center justify-center text-xs text-zinc-500">
            Carregando projetos...
          </div>
        ) : null}

        {!isLoading && projects.length === 0 ? (
          <div
            className={`rounded border border-dashed px-6 py-12 text-center text-xs ${
              isDark
                ? "border-zinc-800 bg-zinc-900/50 text-zinc-500"
                : "border-[#e6eff5] bg-white text-[#718ebf]"
            }`}
          >
            Nenhum projeto cadastrado no banco.
          </div>
        ) : null}

        {!isLoading && projects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => {
              const isEditing = editingProjectId === project.id;
              return (
                <article
                  key={project.id}
                  className={`nexo-surface nexo-project-card flex flex-col justify-between transition-colors ${
                    isDark
                      ? "border-zinc-800 bg-[#161b22] hover:border-zinc-700"
                      : "border-zinc-200 bg-white hover:border-zinc-300"
                  }`}
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
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        className={`nexo-field w-full rounded border outline-none focus:ring-1 focus:ring-zinc-400 ${
                          isDark
                            ? "border-zinc-700 bg-zinc-900 text-zinc-100"
                            : "border-zinc-300 bg-white text-zinc-900"
                        }`}
                      />
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="toolbar-button toolbar-button--accent h-7"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProjectId(null)}
                          className="toolbar-button h-7"
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
                        className="block w-full rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <h2
                            className={`m-0 line-clamp-1 text-sm font-medium ${
                              isDark ? "text-zinc-100" : "text-[#343c6a]"
                            }`}
                          >
                            {project.name}
                          </h2>
                          <span className="font-mono text-[11px] text-zinc-500 shrink-0">
                            {project.itemsCount} {project.itemsCount === 1 ? "item" : "itens"}
                          </span>
                        </div>
                        <p
                          className={`mt-1.5 text-[11px] ${
                            isDark ? "text-zinc-400" : "text-zinc-500"
                          }`}
                        >
                          Modificado em {formatDate(project.updatedAt)}
                        </p>
                      </button>

                      <div
                        className={`mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-2 ${
                          isDark ? "border-zinc-800/80" : "border-[#e6eff5]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onOpenProject(project.id)}
                          className="nexo-project-open rounded text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                          Abrir workspace →
                        </button>

                        <div className="flex flex-wrap items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => onExportProject(project.id)}
                            className="toolbar-button toolbar-button--quiet h-6 px-2 text-[11px]"
                            title="Exportar JSON deste projeto"
                          >
                            Exportar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProjectId(project.id);
                              setEditingName(project.name);
                            }}
                            className="toolbar-button toolbar-button--quiet h-6 px-2 text-[11px]"
                          >
                            Renomear
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProject(project)}
                            className="toolbar-button toolbar-button--quiet toolbar-button--danger h-6 px-2 text-[11px]"
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
