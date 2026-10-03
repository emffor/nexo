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
