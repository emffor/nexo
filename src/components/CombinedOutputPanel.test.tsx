import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CombinedOutputPanel } from "./CombinedOutputPanel";
import type { MarkdownItem } from "../types/markdown";

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
