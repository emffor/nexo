import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SortableCardsPanel } from "./SortableCardsPanel";
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

const ITEMS = [buildItem("item-1", "# Primeiro card")];

describe("SortableCardsPanel", () => {
  it("exibe o botão de alternar para modo índice no modo normal", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <SortableCardsPanel
        items={ITEMS}
        isLoading={false}
        isOutlineMode={false}
        onToggleOutlineMode={onToggle}
        onReorder={vi.fn()}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Alternar para modo índice" });
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("exibe o botão de alternar para modo completo no modo índice", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <SortableCardsPanel
        items={ITEMS}
        isLoading={false}
        isOutlineMode={true}
        onToggleOutlineMode={onToggle}
        onReorder={vi.fn()}
        onSelect={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Alternar para modo completo" });
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});
