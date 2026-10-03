import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { STORAGE_KEYS } from "./lib/preferences";

const projects = ["Alfa", "Beta"].map((name, index) => ({
  id: String(index), name, order: index, itemsCount: 0,
  createdAt: "2026-01-01", updatedAt: "2026-01-01",
}));

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    if (input === "/api/projects") return Response.json(projects);
    const project = projects.find((entry) => input === `/api/projects/${entry.id}`);
    if (project) return Response.json({ project, items: [] });
    if (input.startsWith("/api/diagrams/")) return Response.json({
      id: "diagram", title: "Banco", content: "", state: { positions: {} },
      createdAt: "2026-01-01", updatedAt: "2026-01-01",
    });
    throw new Error(`Requisição inesperada no teste: ${input}`);
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe("estrutura da aplicação", () => {
  it("preserva o tema ao voltar para projetos e abrir outro workspace", async () => {
    render(<App />);
    fireEvent.click((await screen.findAllByRole("button", { name: /^abrir workspace/i }))[0]);
    fireEvent.click(await screen.findByTitle("Alternar tema"));
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe("light");
    fireEvent.click(screen.getByTitle("Voltar para a lista de projetos"));
    fireEvent.click((await screen.findAllByRole("button", { name: /^abrir workspace/i }))[1]);
    expect(await screen.findByTitle("Alternar tema")).toHaveTextContent("Modo escuro");
    expect(window.localStorage.getItem(STORAGE_KEYS.selectedProjectId)).toBe("1");
  });

  it("restaura o projeto selecionado", async () => {
    window.localStorage.setItem(STORAGE_KEYS.selectedProjectId, "1");
    render(<App />);
    await screen.findByTitle("Voltar para a lista de projetos");
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("permite tentar novamente após falha no carregamento", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível carregar");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^abrir workspace/i })).toHaveLength(2));
  });
});
