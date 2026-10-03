import { vi } from 'vitest';
import { db } from '../lib/db';
import { getCardTitle } from '../lib/items';
import { DEFAULT_DATABASE_DBML } from '../types/database';
import type { MarkdownItem } from '../types/markdown';

// Adaptador HTTP em IndexedDB falso: os testes de UI nunca acessam PostgreSQL.
export function mockWorkspaceApi() {
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? 'GET';
    const body = JSON.parse(String(init?.body ?? '{}'));
    const now = new Date().toISOString();
    if (path === '/api/projects') {
      if (method === 'GET') {
        const projects = await db.projects.orderBy('order').toArray();
        return Response.json(await Promise.all(projects.map(async (project) => ({ ...project, itemsCount: await db.items.where('projectId').equals(project.id).count() }))));
      }
      const project = { id: body.id ?? crypto.randomUUID(), name: body.name, order: await db.projects.count(), createdAt: now, updatedAt: now };
      await db.projects.put(project);
      return Response.json({ ...project, itemsCount: 0 });
    }
    if (path.startsWith('/api/projects/')) {
      const id = path.split('/').at(-1)!;
      if (method === 'PUT') await db.projects.update(id, { ...body, updatedAt: now });
      if (method === 'DELETE') {
        await db.projects.delete(id);
        await db.items.where('projectId').equals(id).delete();
        return Response.json({ success: true });
      }
      const project = await db.projects.get(id);
      if (!project) return Response.json({}, { status: 404 });
      if (method === 'PUT') return Response.json(project);
      return Response.json({ project, items: await db.items.where('projectId').equals(id).sortBy('order'), databaseDiagram: await db.databaseDiagrams.get(id) });
    }
    if (path === '/api/items') {
      if (method === 'POST') {
        const count = await db.items.where('projectId').equals(body.projectId).count();
        const entries = (body.batchItems ?? [body]).map((item: Partial<MarkdownItem>, index: number) => ({
          ...item, id: item.id ?? crypto.randomUUID(), projectId: body.projectId,
          title: item.title ?? getCardTitle(item.content ?? ''), content: item.content ?? '',
          order: item.order ?? count + index, createdAt: now, updatedAt: now,
        }));
        await db.items.bulkPut(entries);
        return Response.json(body.batchItems ? { success: true, count: entries.length } : entries[0]);
      }
      if (body.clearProjectId || body.replaceProjectId) {
        await db.items.where('projectId').equals(body.clearProjectId ?? body.replaceProjectId).delete();
        if (body.replaceProjectId) {
          const entries = body.items.map((item: MarkdownItem, order: number) => ({ ...item, projectId: body.replaceProjectId, order }));
          await db.items.bulkPut(entries);
          return Response.json(entries);
        }
      } else {
        await Promise.all(body.items.map((item: { id: string; order: number }) => db.items.update(item.id, { order: item.order })));
      }
      return Response.json({ success: true });
    }
    if (path.startsWith('/api/items/')) {
      const id = path.split('/').at(-1)!;
      if (method === 'DELETE') { await db.items.delete(id); return Response.json({ success: true }); }
      const patch = { ...body, updatedAt: now };
      if (body.content !== undefined) patch.title = body.title || getCardTitle(body.content);
      if (body.status === null) patch.status = undefined;
      if (body.observation === null) patch.observation = undefined;
      await db.items.update(id, patch);
      return Response.json(await db.items.get(id));
    }
    if (path.startsWith('/api/diagrams/')) {
      const projectId = path.split('/').at(-1)!;
      const initial = { id: projectId, projectId, title: 'Diagrama principal', content: DEFAULT_DATABASE_DBML, state: { positions: {} }, createdAt: now, updatedAt: now };
      const record = method === 'DELETE' ? initial : { ...(await db.databaseDiagrams.get(projectId) ?? initial), ...body };
      if (method !== 'GET') await db.databaseDiagrams.put(record);
      return Response.json(record);
    }
    throw new Error(`API não simulada: ${method} ${path}`);
  }));
}
