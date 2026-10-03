import { render, screen } from "@testing-library/react";
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
    for (const [label, mode] of [["Modo normal", "normal"], ["Modo indice", "index"], ["Modo cards", "cards"], ["Modo diagrama", "diagram"], ["Modo banco", "database"]]) {
      await user.click(screen.getByRole("button", { name: label, exact: true }));
      expect(props.onSetViewMode).toHaveBeenLastCalledWith(mode);
    }
    await user.click(screen.getByRole("button", { name: "Projetos", exact: true }));
    expect(props.onBackToProjects).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "+ Novo card", exact: true }));
    expect(props.onOpenModal).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Copiar tudo", exact: true }));
    expect(props.onCopyAll).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Scroll sync", exact: true })).toBeDisabled();
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
    const project = { id: "project-1", name: "Documentação", itemsCount: 2, createdAt: "2026-10-02T12:00:00Z", updatedAt: "2026-10-02T12:00:00Z" };
    const props: ComponentProps<typeof ProjectsHome> = {
      projects: [project], isLoading: false, theme: "light", storedDataSizeBytes: 1024,
      onCreateProject: vi.fn().mockResolvedValue(undefined), onOpenProject: vi.fn(),
      onRenameProject: vi.fn().mockResolvedValue(undefined), onDeleteProject: vi.fn(),
      onExportProject: vi.fn(), onExportAll: vi.fn(), onImportAll: vi.fn(),
    };
    render(<ProjectsHome {...props} />);
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Nome do projeto"), "Novo workspace");
    await user.click(screen.getByRole("button", { name: "Novo Projeto", exact: true }));
    expect(props.onCreateProject).toHaveBeenCalledWith("Novo workspace");
    await user.click(screen.getByRole("button", { name: "Abrir workspace →", exact: true }));
    expect(props.onOpenProject).toHaveBeenCalledWith(project.id);
    await user.click(screen.getByRole("button", { name: "Renomear", exact: true }));
    const inputs = screen.getAllByLabelText("Nome do projeto");
    await user.clear(inputs[1]);
    await user.type(inputs[1], "Nome atualizado");
    await user.click(screen.getByRole("button", { name: "Salvar", exact: true }));
    expect(props.onRenameProject).toHaveBeenCalledWith(project.id, "Nome atualizado");
    await user.click(screen.getByTitle("Exportar JSON deste projeto"));
    expect(props.onExportProject).toHaveBeenCalledWith(project.id);
    await user.click(screen.getByRole("button", { name: "Excluir", exact: true }));
    expect(props.onDeleteProject).toHaveBeenCalledWith(project);
    await user.click(screen.getByRole("button", { name: "Importar", exact: true }));
    expect(props.onImportAll).toHaveBeenCalledOnce();
  });
});
