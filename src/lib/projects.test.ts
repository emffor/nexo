import { describe, expect, it } from 'vitest';
import { db } from './db';
import {
  createProject,
  DEFAULT_PROJECT_ID,
  ensureProjectsReady,
  getProjectData,
} from './projects';

describe('projects', () => {
  it('migra cards antigos para o primeiro projeto', async () => {
    await db.items.put({
      id: 'legacy-card',
      content: '# Antigo',
      order: 0,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    });

    const projects = await ensureProjectsReady();
    const migratedItem = await db.items.get('legacy-card');

    expect(projects).toHaveLength(1);
    expect(projects[0].id).toBe(DEFAULT_PROJECT_ID);
    expect(migratedItem?.projectId).toBe(DEFAULT_PROJECT_ID);
  });

  it('mantem cards isolados por projeto', async () => {
    const firstProject = await createProject('Regularizacao');
    const secondProject = await createProject('Doc Pronto');

    await db.items.bulkPut([
      {
        id: 'regularizacao-card',
        projectId: firstProject.id,
        content: '# Regularizacao',
        order: 0,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
      {
        id: 'doc-pronto-card',
        projectId: secondProject.id,
        content: '# Doc Pronto',
        order: 0,
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T00:00:00.000Z',
      },
    ]);

    const firstData = await getProjectData(firstProject.id);
    const secondData = await getProjectData(secondProject.id);

    expect(firstData?.items.map((item) => item.id)).toEqual([
      'regularizacao-card',
    ]);
    expect(secondData?.items.map((item) => item.id)).toEqual([
      'doc-pronto-card',
    ]);
  });
});
