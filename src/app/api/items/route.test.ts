import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST, PUT } from './route';

const mocks = vi.hoisted(() => {
  const markdownItem = { aggregate: vi.fn(), create: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn(), update: vi.fn() };
  return { markdownItem, transaction: vi.fn() };
});
vi.mock('@/lib/prisma', () => ({ prisma: { markdownItem: mocks.markdownItem, $transaction: mocks.transaction } }));
const request = (body: unknown) => new Request('http://localhost/api/items', { method: 'PUT', body: JSON.stringify(body) });
beforeEach(() => vi.resetAllMocks());

describe('validação e substituição dos cards', () => {
  it.each([null, [], {}, { replaceProjectId: 'p', items: [null] },
    { replaceProjectId: 'p', items: [{ id: 'a', content: 'x' }, { id: 'a', content: 'y' }] },
    { items: [{ id: 'a', order: -1 }] }, { items: [{ id: 'a', order: 1.5 }] },
    { clearProjectId: 'p', items: [] },
  ])('recusa payload inválido sem acessar o banco: %j', async (body) => {
    expect((await PUT(request(body))).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.markdownItem.deleteMany).not.toHaveBeenCalled();
  });

  it('recusa JSON malformado', async () => {
    expect((await POST(new Request('http://localhost/api/items', { method: 'POST', body: '{' }))).status).toBe(400);
  });

  it('rejeita lote que aponta para outro projeto', async () => {
    expect((await POST(request({ projectId: 'p', batchItems: [{ projectId: 'outro', content: 'x' }] }))).status).toBe(400);
    expect(mocks.markdownItem.createMany).not.toHaveBeenCalled();
  });

  it('executa remoção e criação na mesma transação, preservando IDs e escopo', async () => {
    const tx = { markdownItem: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) } };
    mocks.transaction.mockImplementation((operation) => operation(tx));
    const response = await PUT(request({ replaceProjectId: 'p', items: [{ id: 'original', content: '# Card', projectId: 'backup' }] }));
    expect(response.status).toBe(200);
    expect(tx.markdownItem.deleteMany).toHaveBeenCalledWith({ where: { projectId: 'p' } });
    expect(tx.markdownItem.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ id: 'original', projectId: 'p', order: 0 })] });
    expect(mocks.markdownItem.deleteMany).not.toHaveBeenCalled();
  });

  it('retorna falha quando a transação é rejeitada', async () => {
    mocks.transaction.mockRejectedValue(new Error('collision'));
    expect((await PUT(request({ replaceProjectId: 'p', items: [{ id: 'a', content: 'x' }] }))).status).toBe(500);
  });

  it('usa a última ordem e informa quantos itens foram realmente inseridos', async () => {
    mocks.markdownItem.aggregate.mockResolvedValue({ _max: { order: 7 } });
    mocks.markdownItem.createMany.mockResolvedValue({ count: 1 });
    const response = await POST(request({ projectId: 'p', batchItems: [{ content: 'a' }, { content: 'b' }] }));
    expect(await response.json()).toEqual({ success: true, count: 1 });
    expect(mocks.markdownItem.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ order: 8 }), expect.objectContaining({ order: 9 })] }));
  });
});
