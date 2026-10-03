import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResizableColumns } from "./ResizableColumns";

const STORAGE_KEY = "test:cards-column-width";

function renderColumns() {
  return render(
    <ResizableColumns
      left={<div>Coluna esquerda</div>}
      right={<div>Coluna direita</div>}
      storageKey={STORAGE_KEY}
      defaultWidth={320}
      minWidth={220}
      maxWidth={640}
    />,
  );
}

describe("ResizableColumns", () => {
  it("renderiza as duas colunas e o divisor acessivel", () => {
    window.localStorage.removeItem(STORAGE_KEY);
    renderColumns();

    expect(screen.getByText("Coluna esquerda")).toBeInTheDocument();
    expect(screen.getByText("Coluna direita")).toBeInTheDocument();

    const separator = screen.getByRole("separator");
    expect(separator).toHaveAttribute("aria-orientation", "vertical");
    expect(separator).toHaveAttribute("aria-valuenow", "320");
  });

  it("restaura a largura salva no localStorage", () => {
    window.localStorage.setItem(STORAGE_KEY, "420");
    renderColumns();

    expect(screen.getByRole("separator")).toHaveAttribute(
      "aria-valuenow",
      "420",
    );
  });

  it("ignora valor invalido salvo e usa o padrao", () => {
    window.localStorage.setItem(STORAGE_KEY, "largura-invalida");
    renderColumns();

    expect(screen.getByRole("separator")).toHaveAttribute(
      "aria-valuenow",
      "320",
    );
  });

  it("limita a largura salva aos valores minimo e maximo", () => {
    window.localStorage.setItem(STORAGE_KEY, "5000");
    const { unmount } = renderColumns();

    expect(screen.getByRole("separator")).toHaveAttribute(
      "aria-valuenow",
      "640",
    );
    unmount();

    window.localStorage.setItem(STORAGE_KEY, "10");
    renderColumns();

    expect(screen.getByRole("separator")).toHaveAttribute(
      "aria-valuenow",
      "220",
    );
  });

  it("ajusta a largura pelo teclado e persiste", () => {
    window.localStorage.removeItem(STORAGE_KEY);
    renderColumns();

    const separator = screen.getByRole("separator");
    fireEvent.keyDown(separator, { key: "ArrowRight" });

    expect(separator).toHaveAttribute("aria-valuenow", "336");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("336");

    fireEvent.keyDown(separator, { key: "ArrowLeft" });

    expect(separator).toHaveAttribute("aria-valuenow", "320");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("320");
  });

  it("vai aos limites pelo Home e End", () => {
    window.localStorage.removeItem(STORAGE_KEY);
    renderColumns();

    const separator = screen.getByRole("separator");
    fireEvent.keyDown(separator, { key: "End" });

    expect(separator).toHaveAttribute("aria-valuenow", "640");

    fireEvent.keyDown(separator, { key: "Home" });

    expect(separator).toHaveAttribute("aria-valuenow", "220");
  });
});
