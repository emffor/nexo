import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROJECT_ID, DEFAULT_PROJECT_NAME, ensureProjectsReady, getAllProjectsData, getProjectData } from './projects';
import { createProjectApi, fetchProjectDetails, fetchProjects } from '../services/projectsApi';

vi.mock('../services/projectsApi', () => ({
  fetchProjects: vi.fn(), createProjectApi: vi.fn(), fetchProjectDetails: vi.fn(),
  updateProjectApi: vi.fn(), deleteProjectApi: vi.fn(),
}));
const projects = ['a', 'b'].map((id) => ({ id, name: id, order: 0, createdAt: '', updatedAt: '', itemsCount: 1 }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchProjects).mockResolvedValue(projects);
});

describe('projects', () => {
  it('prepara o primeiro projeto via API quando não há projetos', async () => {
    vi.mocked(fetchProjects).mockResolvedValue([]);
    vi.mocked(createProjectApi).mockResolvedValue({ ...projects[0], id: DEFAULT_PROJECT_ID });
    const result = await ensureProjectsReady();
    expect(result[0].id).toBe(DEFAULT_PROJECT_ID);
    expect(createProjectApi).toHaveBeenCalledWith(DEFAULT_PROJECT_NAME, DEFAULT_PROJECT_ID);
  });

  it('mantém as consultas de cards isoladas por projeto', async () => {
    vi.mocked(fetchProjectDetails).mockImplementation(async (id) => ({
      project: projects.find((project) => project.id === id)!,
      items: [{ id: `${id}-card`, projectId: id, content: id, order: 0, createdAt: '', updatedAt: '' }],
    }));
    expect((await getProjectData('a'))?.items.map((item) => item.id)).toEqual(['a-card']);
    expect((await getProjectData('b'))?.items.map((item) => item.id)).toEqual(['b-card']);
  });

  it('recusa backup completo se um projeto falhar, sem omiti-lo silenciosamente', async () => {
    vi.mocked(fetchProjectDetails).mockResolvedValueOnce({ project: projects[0], items: [] }).mockRejectedValueOnce(new Error('offline'));
    await expect(getAllProjectsData()).rejects.toThrow('offline');
  });

  it('reutiliza os resumos já carregados', async () => {
    vi.mocked(fetchProjectDetails).mockResolvedValue({ project: projects[0], items: [] });
    await getAllProjectsData(projects);
    expect(fetchProjects).not.toHaveBeenCalled();
    expect(fetchProjectDetails).toHaveBeenCalledTimes(2);
  });
});

it('remapeia conexões e visibilidade ao importar um backup em outro projeto', async () => {
  const { remapDiagramState, remapHiddenDiagramItemIds } = await import('./projects');
  const ids = new Map([['original-a', 'novo-a'], ['original-b', 'novo-b']]);
  const next = remapDiagramState({ positions: { 'original-a': { x: 20, y: 30 } }, edges: [{ id: 'edge', from: 'original-a', to: 'original-b' }] }, ids);
  expect(next?.positions).toEqual({ 'novo-a': { x: 20, y: 30 } });
  expect(next?.edges).toEqual([expect.objectContaining({ from: 'novo-a', to: 'novo-b' })]);
  expect(remapHiddenDiagramItemIds(['original-b'], ids)).toEqual(['novo-b']);
});
