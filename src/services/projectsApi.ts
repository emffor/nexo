import type { Project, ProjectSummary } from '../types/project';
import type { DatabaseDiagramRecord } from '../types/database';
import type { MarkdownItem } from '../types/markdown';

export interface ProjectDetailsResponse {
  project: Project;
  items: MarkdownItem[];
  databaseDiagram?: DatabaseDiagramRecord;
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) {
    throw new Error('Falha ao buscar projetos');
  }
  return res.json();
}

export async function createProjectApi(name?: string, id?: string): Promise<ProjectSummary> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, id }),
  });
  if (!res.ok) {
    throw new Error('Falha ao criar projeto');
  }
  return res.json();
}

export async function fetchProjectDetails(id: string): Promise<ProjectDetailsResponse> {
  const res = await fetch(`/api/projects/${id}`);
  if (!res.ok) {
    throw new Error('Falha ao carregar detalhes do projeto');
  }
  return res.json();
}

export async function updateProjectApi(
  id: string,
  patch: Partial<Project>
): Promise<Project> {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error('Falha ao atualizar projeto');
  }
  return res.json();
}

export async function deleteProjectApi(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error('Falha ao remover projeto');
  }
}
