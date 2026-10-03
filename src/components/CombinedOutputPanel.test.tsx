import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CombinedOutputPanel } from "./CombinedOutputPanel";
import type { DragEndEvent } from "@dnd-kit/core";
import type { MarkdownItem } from "../types/markdown";

const drag = vi.hoisted(() => ({
  onEnd: undefined as undefined | ((event: DragEndEvent) => Promise<void>),
}));

vi.mock("@dnd-kit/core", async (importOriginal) => {
  const original = await importOriginal<typeof import("@dnd-kit/core")>();
  return {
    ...original,
    DndContext: (props: React.ComponentProps<typeof original.DndContext>) => {
      drag.onEnd = props.onDragEnd as typeof drag.onEnd;
      return <original.DndContext {...props} />;
    },
  };
});

function buildItem(id: string, content: string): MarkdownItem {
  return {
    id,
    content,
    order: 0,
    createdAt: "2026-10-02T12:00:00.000Z",
    updatedAt: "2026-10-02T12:00:00.000Z",
  };
}

const ITEMS = [buildItem("item-1", "# Primeiro card"), buildItem("item-2", "# Segundo card")];

describe("CombinedOutputPanel no modo normal", () => {
  it("exibe somente o card ativo de forma estatica", () => {
    render(
      <CombinedOutputPanel
        items={ITEMS}
        isLoading={false}
        theme="light"
        viewMode="normal"
        activeItemId="item-2"
        onSelect={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Segundo card", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Primeiro card", level: 1 })).not.toBeInTheDocument();
  });

  it("troca o card exibido sem rolagem programatica", () => {
    const scrollSpy = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    const { rerender } = render(
      <CombinedOutputPanel
        items={ITEMS}
        isLoading={false}
        theme="light"
        viewMode="normal"
        activeItemId="item-1"
        onSelect={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Primeiro card", level: 1 })).toBeInTheDocument();

    rerender(
      <CombinedOutputPanel
        items={ITEMS}
        isLoading={false}
        theme="light"
        viewMode="normal"
        activeItemId="item-2"
        onSelect={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Segundo card", level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Primeiro card", level: 1 })).not.toBeInTheDocument();
    expect(scrollSpy).not.toHaveBeenCalled();
  });
});

describe("CombinedOutputPanel no modo indice", () => {
  it("exibe somente o card ativo", () => {
    render(
      <CombinedOutputPanel
        items={ITEMS}
        isLoading={false}
        theme="light"
        viewMode="index"
        activeItemId="item-2"
        onSelect={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(screen.queryByRole("heading", { name: "Primeiro card", level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Segundo card", level: 1 })).toBeInTheDocument();
  });

  it("reseta o scroll para o topo ao trocar o card ativo", () => {
    const scrollContainerRef = { current: document.createElement("div") };
    scrollContainerRef.current.scrollTop = 400;

    const { rerender } = render(
      <CombinedOutputPanel
        items={ITEMS}
        isLoading={false}
        theme="light"
        viewMode="index"
        activeItemId="item-1"
        scrollContainerRef={scrollContainerRef}
        onSelect={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(scrollContainerRef.current.scrollTop).toBe(0);

    scrollContainerRef.current.scrollTop = 300;

    rerender(
      <CombinedOutputPanel
        items={ITEMS}
        isLoading={false}
        theme="light"
        viewMode="index"
        activeItemId="item-2"
        scrollContainerRef={scrollContainerRef}
        onSelect={vi.fn()}
        onReorder={vi.fn()}
      />,
    );

    expect(scrollContainerRef.current.scrollTop).toBe(0);
  });
});

describe("CombinedOutputPanel no modo kanban", () => {
  const boardItems: MarkdownItem[] = [
    ITEMS[0],
    { ...ITEMS[1], status: "finalizado" },
    { ...buildItem("item-3", "# Terceiro card"), status: "finalizado" },
  ];

  function renderBoard(items = boardItems) {
    const onSelect = vi.fn();
    const onReorder = vi.fn().mockResolvedValue(undefined);
    const onChangeStatus = vi.fn();
    render(<CombinedOutputPanel items={items} isLoading={false} theme="light" viewMode="cards" onSelect={onSelect} onReorder={onReorder} onChangeStatus={onChangeStatus} />);
    return { onSelect, onReorder, onChangeStatus };
  }

  async function drop(active: string, over: string | null) {
    await act(async () => {
      await drag.onEnd?.({ active: { id: active }, over: over ? { id: over } : null } as DragEndEvent);
    });
  }

  it("agrupa por status sem classificar automaticamente cards sem status", () => {
    renderBoard();
    expect(within(screen.getByRole("region", { name: "Sem status: 1 cards" })).getByRole("button", { name: "Selecionar card Primeiro card" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Finalizado: 2 cards" })).getAllByRole("button", { name: /^Selecionar card/ })).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Revisando: 0 cards" })).toBeInTheDocument();
  });

  it("mantém as colunas disponíveis em um projeto vazio", () => {
    renderBoard([]);
    expect(screen.getAllByRole("region")).toHaveLength(6);
  });

  it("abre o preview por teclado e permite voltar ao quadro", () => {
    const { onSelect } = renderBoard();
    fireEvent.keyDown(screen.getByRole("button", { name: "Selecionar card Primeiro card" }), { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(boardItems[0]);
    expect(screen.getByRole("heading", { name: "Preview Markdown" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar aos cards" }));
    expect(screen.getByRole("heading", { name: "Quadro de cards" })).toBeInTheDocument();
  });

  it("altera status ao soltar numa coluna vazia sem reordenar o projeto", async () => {
    const { onChangeStatus, onReorder, onSelect } = renderBoard();
    await drop("item-1", "kanban-column-revisando");
    expect(onChangeStatus).toHaveBeenCalledWith("item-1", "revisando");
    expect(onReorder).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Selecionar card Primeiro card" }));
    expect(onSelect).toHaveBeenCalledWith(boardItems[0]);
  });

  it("adota o status do card de destino e permite retornar a sem status", async () => {
    const { onChangeStatus } = renderBoard();
    await drop("item-1", "item-2");
    expect(onChangeStatus).toHaveBeenLastCalledWith("item-1", "finalizado");
    await drop("item-2", "kanban-column-none");
    expect(onChangeStatus).toHaveBeenLastCalledWith("item-2", undefined);
  });

  it("reordena cards dentro da mesma coluna", async () => {
    const { onChangeStatus, onReorder } = renderBoard();
    await drop("item-2", "item-3");
    expect(onReorder).toHaveBeenCalledWith("item-2", "item-3");
    expect(onChangeStatus).not.toHaveBeenCalled();
  });

  it("não altera dados ao soltar fora do quadro ou sobre o próprio card", async () => {
    const { onChangeStatus, onReorder } = renderBoard();
    await drop("item-1", null);
    await drop("item-1", "item-1");
    expect(onChangeStatus).not.toHaveBeenCalled();
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("renderiza o card inteiro como elemento interativo e sem botão isolado para mover", () => {
    renderBoard();
    const card = screen.getByRole("button", { name: "Selecionar card Primeiro card" });
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass("cursor-grab");
    expect(screen.queryByRole("button", { name: /Mover card/i })).not.toBeInTheDocument();
  });
});

it('bloqueia elementos HTML ativos e mantém Markdown, tabelas e listas de tarefas', () => {
  const content = '# Seguro\n\n<style>body { display: none }</style>\n\n<iframe src="https://example.com"></iframe>\n\n<form action="/api/items"><button>Enviar</button></form>\n\n- [x] Feito\n\n| Coluna |\n| --- |\n| Valor |';
  const { container } = render(<CombinedOutputPanel items={[buildItem('safe', content)]} isLoading={false} theme="light" viewMode="normal" onSelect={vi.fn()} onReorder={vi.fn()} />);
  expect(container.querySelector('style, iframe, form, button[type="submit"]')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Seguro' })).toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getByRole('checkbox')).toBeDisabled();
});
