"use client";

import { useState, type FormEvent } from "react";
import type { AppTheme } from "../lib/preferences";
import type { ProjectSummary } from "../lib/projects";

interface ProjectsHomeProps {
  projects: ProjectSummary[];
  isLoading: boolean;
  theme: AppTheme;
  onCreateProject: (name: string) => Promise<void>;
  onOpenProject: (projectId: string) => void;
  onRenameProject: (projectId: string, name: string) => Promise<void>;
  onDeleteProject: (project: ProjectSummary) => void;
  onExportProject: (projectId: string) => void;
  onExportAll: () => void;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function ProjectsHome({
  projects,
  isLoading,
  theme,
  onCreateProject,
  onOpenProject,
  onRenameProject,
  onDeleteProject,
  onExportProject,
  onExportAll,
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
      className={`min-h-screen px-4 py-6 sm:px-6 lg:px-8 ${
        isDark ? "bg-ink text-white" : "bg-slate-50 text-slate-950"
      }`}
    >
      <section
        className={`mx-auto flex max-w-6xl flex-col gap-5 rounded-[1.25rem] border px-5 py-5 sm:px-6 ${
          isDark
            ? "border-white/10 bg-[#11161c]"
            : "border-slate-200 bg-white shadow-sm"
        }`}
      >
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p
              className={`mb-1 text-[10px] font-medium uppercase tracking-[0.24em] ${
                isDark ? "text-teal-200/80" : "text-sky-700"
              }`}
            >
              Organizador de conteudo
            </p>
            <h1 className="m-0 text-[1.75rem] font-semibold leading-tight">
              Projetos
            </h1>
            <p
              className={`mt-1 text-sm ${
                isDark ? "text-slate-300" : "text-slate-600"
              }`}
            >
              Separe seus conjuntos de tasks e acesse cada workspace isolado.
            </p>
          </div>

          <button
            type="button"
            onClick={onExportAll}
            disabled={projects.length === 0}
            className="toolbar-button toolbar-button--accent self-start md:self-auto"
          >
            Exportar tudo
          </button>
        </header>

        <form
          onSubmit={handleCreate}
          className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row ${
            isDark
              ? "border-white/[0.08] bg-white/[0.03]"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <label className="sr-only" htmlFor="new-project-name">
            Nome do projeto
          </label>
          <input
            id="new-project-name"
            value={newProjectName}
            onChange={(event) => setNewProjectName(event.target.value)}
            placeholder="Nome do projeto"
            className={`min-h-10 flex-1 rounded-md border px-3 text-sm outline-none transition focus:ring-2 focus:ring-teal-300 ${
              isDark
                ? "border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500"
                : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            }`}
          />
          <button type="submit" className="toolbar-button toolbar-button--accent">
            Adicionar projeto
          </button>
        </form>

        {isLoading ? (
          <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-400">
            Carregando projetos...
          </div>
        ) : null}

        {!isLoading && projects.length === 0 ? (
          <div
            className={`rounded-lg border border-dashed px-6 py-10 text-center ${
              isDark
                ? "border-slate-700 bg-[#0c1219] text-slate-400"
                : "border-slate-300 bg-white text-slate-500"
            }`}
          >
            Nenhum projeto ainda.
          </div>
        ) : null}

        {!isLoading && projects.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => {
              const isEditing = editingProjectId === project.id;
              return (
                <article
                  key={project.id}
                  className={`rounded-lg border p-4 ${
                    isDark
                      ? "border-slate-800 bg-[#0c1219]"
                      : "border-slate-200 bg-white shadow-sm"
                  }`}
                >
                  {isEditing ? (
                    <form onSubmit={handleRename} className="flex flex-col gap-2">
                      <label className="sr-only" htmlFor={`project-name-${project.id}`}>
                        Nome do projeto
                      </label>
                      <input
                        id={`project-name-${project.id}`}
                        value={editingName}
                        onChange={(event) => setEditingName(event.target.value)}
                        className={`min-h-10 rounded-md border px-3 text-sm outline-none focus:ring-2 focus:ring-teal-300 ${
                          isDark
                            ? "border-slate-700 bg-slate-950 text-slate-100"
                            : "border-slate-300 bg-white text-slate-900"
                        }`}
                      />
                      <div className="flex gap-2">
                        <button type="submit" className="toolbar-button toolbar-button--accent">
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingProjectId(null)}
                          className="toolbar-button"
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
                        className="block w-full text-left"
                      >
                        <h2 className="m-0 line-clamp-2 text-lg font-semibold">
                          {project.name}
                        </h2>
                        <p
                          className={`mt-2 text-sm ${
                            isDark ? "text-slate-400" : "text-slate-500"
                          }`}
                        >
                          {project.itemsCount} card
                          {project.itemsCount === 1 ? "" : "s"} · Atualizado em{" "}
                          {formatDate(project.updatedAt)}
                        </p>
                      </button>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenProject(project.id)}
                          className="toolbar-button toolbar-button--accent"
                        >
                          Abrir
                        </button>
                        <button
                          type="button"
                          onClick={() => onExportProject(project.id)}
                          className="toolbar-button"
                        >
                          Exportar projeto
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingProjectId(project.id);
                            setEditingName(project.name);
                          }}
                          className="toolbar-button"
                        >
                          Renomear
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProject(project)}
                          className="toolbar-button"
                        >
                          Excluir
                        </button>
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
