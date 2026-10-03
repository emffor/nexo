import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PreferencesProvider } from "../contexts/PreferencesContext";
import { useProjectWorkspace } from "./useProjectWorkspace";
import type { Project } from "../types/project";

const project: Project = {
  id: "project", name: "Projeto", order: 0,
  createdAt: "2026-01-01", updatedAt: "2026-01-01",
  hiddenDiagramItemIds: ["a", "removido"],
};

afterEach(() => vi.unstubAllGlobals());

describe("useProjectWorkspace", () => {
  it("deriva seleção e visibilidade sem persistir durante a hidratação", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/projects/project") return Response.json({
        project, items: [
          { id: "a", content: "# A", order: 0 },
          { id: "b", content: "# B", order: 1 },
        ]
      });
      if (url === "/api/diagrams/project") return Response.json({
        id: "diagram", content: "", state: { positions: {} },
      });
      throw new Error("Requisição inesperada");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useProjectWorkspace(project), { wrapper: PreferencesProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.activeItemId).toBe("a");
    expect([...result.current.hiddenDiagramItemIds]).toEqual(["a"]);
    expect(fetchMock.mock.calls.every((call) => call.length === 1)).toBe(true);
    act(() => result.current.handleToggleDiagramItemVisibility("b"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/projects/project", expect.objectContaining({
      method: "PUT", body: JSON.stringify({ hiddenDiagramItemIds: ["a", "b"] }),
    })));
    expect([...result.current.hiddenDiagramItemIds]).toEqual(["a", "b"]);
  });

  it("atualiza workspaceProject e persiste diagrama ao mudar estado do diagrama", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/projects/project") return Response.json({
        project, items: []
      });
      if (url === "/api/diagrams/project") return Response.json({
        id: "diagram", content: "", state: { positions: {} },
      });
      throw new Error("Requisição inesperada");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useProjectWorkspace(project), { wrapper: PreferencesProvider });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const nextState = {
      positions: { "1": { x: 10, y: 20 } },
      edges: [{ id: "e1", from: "1", to: "2" }],
    };

    act(() => result.current.handleDiagramStateChange(nextState));

    expect(result.current.workspaceProject.diagramState).toEqual(nextState);
    expect(result.current.diagramStateRef.current).toEqual(nextState);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/projects/project", expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ diagramState: nextState }),
    })));
  });
});

it('desfaz limpeza restaurando IDs, conexões, visibilidade e DBML', async () => {
  const card = { id: 'a', projectId: project.id, content: '# A', order: 0, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
  const originalDiagram = { positions: { a: { x: 10, y: 20 } }, edges: [] };
  const database = { id: project.id, projectId: project.id, title: 'Banco', content: '// original', state: { positions: {} }, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
  const requests: Array<{ url: string; method?: string; body: Record<string, unknown> }> = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    requests.push({ url, method: init?.method, body });
    if (url === '/api/projects/project') return Response.json({ project, items: [card] });
    if (url === '/api/diagrams/project') return Response.json(init?.method === 'DELETE' ? { ...database, content: '// reset' } : database);
    if (url === '/api/items') return Response.json(body.replaceProjectId ? body.items : { success: true });
    throw new Error('Requisição inesperada');
  }));
  const { result } = renderHook(() => useProjectWorkspace({ ...project, diagramState: originalDiagram }), { wrapper: PreferencesProvider });
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  await act(() => result.current.executeClearAll());
  expect(result.current.items).toHaveLength(0);
  act(() => result.current.messages.find((message) => message.action)?.action?.onClick());
  await waitFor(() => expect(result.current.workspaceProject.diagramState).toEqual(originalDiagram));
  expect(result.current.items[0].id).toBe('a');
  expect([...result.current.hiddenDiagramItemIds]).toEqual(['a']);
  expect(requests).toContainEqual(expect.objectContaining({ url: '/api/diagrams/project', method: 'PUT', body: expect.objectContaining({ content: '// original' }) }));
});

it('importa cards e remapeia referências sem reutilizar IDs de outro projeto', async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    requests.push({ url, body });
    if (url === '/api/projects/project') return Response.json({ project, items: [] });
    if (url === '/api/diagrams/project') return Response.json({ id: 'db', content: '', state: { positions: {} } });
    if (url === '/api/items') return Response.json(body.items);
    throw new Error('Requisição inesperada');
  }));
  const { result } = renderHook(() => useProjectWorkspace(project), { wrapper: PreferencesProvider });
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  const backup = {
    version: 1, exportedAt: '2026-01-01',
    items: ['a', 'b'].map((id, order) => ({ id, content: id, order, createdAt: '2026-01-01', updatedAt: '2026-01-01' })),
    diagramState: { positions: { a: { x: 20, y: 30 } }, edges: [{ id: 'edge', from: 'a', to: 'b' }] },
    hiddenDiagramItemIds: ['b'],
  };
  const target = { files: [new File([JSON.stringify(backup)], 'backup.json')], value: 'backup.json' };
  await act(() => result.current.handleImportFile({ target } as unknown as React.ChangeEvent<HTMLInputElement>));
  const [first, second] = result.current.items;
  expect(first.id).not.toBe('a');
  expect(second.id).not.toBe('b');
  expect(result.current.workspaceProject.diagramState?.positions).toEqual({ [first.id]: { x: 20, y: 30 } });
  expect(result.current.workspaceProject.diagramState?.edges[0]).toEqual(expect.objectContaining({ from: first.id, to: second.id }));
  expect([...result.current.hiddenDiagramItemIds]).toEqual([second.id]);
  expect(target.value).toBe('');
});
