import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { ProjectsHome } from "./ProjectsHome";

function shellProps(): ComponentProps<typeof AppShell> {
  return {
    itemsCount: 2,
    isPreviewMaximized: false,
    isDiagramSidebarVisible: true,
    diagramEdgeStyle: "curve",
    databaseEdgeStyle: "square",
    viewMode: "cards",
    projectName: "Documentação",
    storedDataSizeBytes: 1024,
    isScrollSyncEnabled: false,
    theme: "light",
    fontScale: 1,
    onBackToProjects: vi.fn(),
    onOpenModal: vi.fn(),
    onTogglePreviewMaximized: vi.fn(),
    onToggleDiagramSidebar: vi.fn(),
    onSetDiagramEdgeStyle: vi.fn(),
    onSetDatabaseEdgeStyle: vi.fn(),
    onSetViewMode: vi.fn(),
    onToggleScrollSync: vi.fn(),
    onToggleTheme: vi.fn(),
    onClearAll: vi.fn(),
    onDecreaseFont: vi.fn(),
    onIncreaseFont: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onCopyAll: vi.fn(),
    leftPanel: <p>Editor</p>,
    rightPanel: <p>Preview</p>,
  };
}

describe("navegação do workspace", () => {
  it("preserva os modos e callbacks ao navegar pelo topo", async () => {
    const user = userEvent.setup();
    const props = shellProps();
    render(<AppShell {...props} />);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Visualizações do workspace" })).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Modo cards" })).toHaveAttribute("aria-pressed", "true");
    for (const [label, mode] of [["Modo normal", "normal"], ["Modo cards", "cards"], ["Modo diagrama", "diagram"], ["Modo banco", "database"]]) {
      await user.click(screen.getByRole("button", { name: label }));
      expect(props.onSetViewMode).toHaveBeenLastCalledWith(mode);
    }
    await user.click(screen.getByRole("button", { name: "Projetos" }));
    expect(props.onBackToProjects).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "+ Novo card" }));
    expect(props.onOpenModal).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Copiar tudo" }));
    expect(props.onCopyAll).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Scroll sync" })).not.toBeInTheDocument();
    const tools = screen.getByRole("button", { name: "Ferramentas do workspace" });
    await user.click(tools);
    expect(tools).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Scroll sync" })).toBeDisabled();
    await user.click(tools);
    expect(tools).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "Limpar tudo" })).not.toBeInTheDocument();
  });

  it("exibe o botao flutuante de ocultar a coluna apenas quando habilitado", async () => {
    const user = userEvent.setup();
    const props = shellProps();
    const { rerender } = render(<AppShell {...props} />);

    expect(
      screen.queryByRole("button", { name: /coluna de cards/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /alternar risco da seleção/i }),
    ).not.toBeInTheDocument();

    rerender(
      <AppShell
        {...props}
        isSidebarToggleVisible
        isSidebarHidden={false}
        isStrikethroughVisible
        onToggleStrikethrough={vi.fn()}
      />,
    );

    const toggleButton = screen.getByRole("button", {
      name: "Ocultar coluna de cards",
    });
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");
    await user.click(toggleButton);
    expect(props.onTogglePreviewMaximized).toHaveBeenCalledOnce();

    expect(
      screen.getByRole("button", { name: /alternar risco da seleção/i }),
    ).toBeInTheDocument();

    rerender(
      <AppShell {...props} isSidebarToggleVisible isSidebarHidden />,
    );

    expect(
      screen.getByRole("button", { name: "Exibir coluna de cards" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("preserva a criação, abertura, renomeação e ações de projeto", async () => {
    const user = userEvent.setup();
    const project = { id: "project-1", order: 0, name: "Documentação", itemsCount: 2, createdAt: "2026-10-02T12:00:00Z", updatedAt: "2026-10-02T12:00:00Z" };
    const props: ComponentProps<typeof ProjectsHome> = {
      projects: [project], isLoading: false, theme: "light", storedDataSizeBytes: 1024,
      onCreateProject: vi.fn().mockResolvedValue(undefined), onOpenProject: vi.fn(),
      onRenameProject: vi.fn().mockResolvedValue(undefined), onDeleteProject: vi.fn(),
      onExportProject: vi.fn(), onExportAll: vi.fn(), onImportAll: vi.fn(),
    };
    render(<ProjectsHome {...props} />);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Nome do projeto"), "Novo workspace");
    await user.click(screen.getByRole("button", { name: "Novo Projeto" }));
    expect(props.onCreateProject).toHaveBeenCalledWith("Novo workspace");
    await user.click(screen.getByRole("button", { name: "Abrir workspace →" }));
    expect(props.onOpenProject).toHaveBeenCalledWith(project.id);
    await user.click(screen.getByRole("button", { name: "Renomear" }));
    const inputs = screen.getAllByLabelText("Nome do projeto");
    await user.clear(inputs[1]);
    await user.type(inputs[1], "Nome atualizado");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(props.onRenameProject).toHaveBeenCalledWith(project.id, "Nome atualizado");
    await user.click(screen.getByTitle("Exportar JSON deste projeto"));
    expect(props.onExportProject).toHaveBeenCalledWith(project.id);
    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(props.onDeleteProject).toHaveBeenCalledWith(project);
    await user.click(screen.getByRole("button", { name: "Importar" }));
    expect(props.onImportAll).toHaveBeenCalledOnce();
  });
});

function projectProps(): ComponentProps<typeof ProjectsHome> {
  return {
    projects: [
      { id: "a", order: 0, name: "Documentação", itemsCount: 2, createdAt: "2026-10-02T12:00:00Z", updatedAt: "2026-10-02T12:00:00Z" },
      { id: "b", order: 1, name: "Planejamento", itemsCount: 0, createdAt: "2026-10-02T12:00:00Z", updatedAt: "2026-10-02T12:00:00Z" },
    ],
    isLoading: false, theme: "light", storedDataSizeBytes: 1024,
    onCreateProject: vi.fn().mockResolvedValue(undefined), onOpenProject: vi.fn(),
    onRenameProject: vi.fn().mockResolvedValue(undefined), onDeleteProject: vi.fn(),
    onExportProject: vi.fn(), onExportAll: vi.fn(), onImportAll: vi.fn(),
  };
}

describe("fluxo de projetos", () => {
  it("filtra por nome e permite limpar uma busca sem resultados", async () => {
    const user = userEvent.setup();
    render(<ProjectsHome {...projectProps()} />);
    const search = screen.getByRole("searchbox", { name: "Buscar projetos" });
    await user.type(search, "DOCUMENTAÇÃO");
    expect(screen.getByRole("heading", { name: "Documentação" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Planejamento" })).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "inexistente");
    expect(screen.getByText(/Nenhum projeto encontrado/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar busca" }));
    expect(screen.getByRole("heading", { name: "Planejamento" })).toBeInTheDocument();
  });

  it("impede reenvio enquanto cria e preserva o nome após falha", async () => {
    const user = userEvent.setup();
    const props = projectProps();
    let rejectRequest!: (reason: Error) => void;
    props.onCreateProject = vi.fn(() => new Promise<void>((_, reject) => { rejectRequest = reject; }));
    render(<ProjectsHome {...props} />);
    expect(screen.getByRole("button", { name: "Novo Projeto" })).toBeDisabled();
    await user.type(screen.getByLabelText("Nome do projeto"), "Novo projeto");
    await user.click(screen.getByRole("button", { name: "Novo Projeto" }));
    expect(screen.getByRole("button", { name: "Criando..." })).toBeDisabled();
    await act(async () => rejectRequest(new Error("Falha")));
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível criar");
    expect(screen.getByLabelText("Nome do projeto")).toHaveValue("Novo projeto");
    expect(props.onCreateProject).toHaveBeenCalledOnce();
  });

  it("preserva a edição e permite tentar novamente quando renomear falha", async () => {
    const user = userEvent.setup();
    const props = projectProps();
    props.onRenameProject = vi.fn().mockRejectedValueOnce(new Error("Falha")).mockResolvedValueOnce(undefined);
    render(<ProjectsHome {...props} />);
    await user.click(screen.getAllByRole("button", { name: "Renomear" })[0]);
    const input = screen.getAllByLabelText("Nome do projeto")[1];
    await user.clear(input);
    await user.type(input, "Novo nome");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível renomear");
    expect(input).toHaveValue("Novo nome");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(props.onRenameProject).toHaveBeenLastCalledWith("a", "Novo nome");
  });
});
