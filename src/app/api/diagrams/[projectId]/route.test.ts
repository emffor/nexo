import { beforeEach, expect, it, vi } from 'vitest';
import { GET } from './route';
const mocks = vi.hoisted(() => ({ findDiagram: vi.fn(), findProject: vi.fn(), create: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  databaseDiagram: { findUnique: mocks.findDiagram, create: mocks.create },
  project: { findUnique: mocks.findProject },
} }));
beforeEach(() => vi.resetAllMocks());
it('entrega exemplo sem criar registro durante GET', async () => {
  mocks.findDiagram.mockResolvedValue(null);
  mocks.findProject.mockResolvedValue({ id: 'p', createdAt: new Date(), updatedAt: new Date() });
  const response = await GET(new Request('http://localhost'), { params: { projectId: 'p' } });
  expect(response.status).toBe(200);
  expect((await response.json()).content).toContain('Table');
  expect(mocks.create).not.toHaveBeenCalled();
});
it('retorna 404 para projeto inexistente', async () => {
  mocks.findDiagram.mockResolvedValue(null);
  mocks.findProject.mockResolvedValue(null);
  expect((await GET(new Request('http://localhost'), { params: { projectId: 'missing' } })).status).toBe(404);
  expect(mocks.create).not.toHaveBeenCalled();
});
