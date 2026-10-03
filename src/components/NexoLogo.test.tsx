import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NexoLogo } from "./NexoLogo";

describe("NexoLogo", () => {
  it("renderiza barras pretas e detalhes azuis no tema light", () => {
    const { container } = render(<NexoLogo theme="light" />);
    const rects = container.querySelectorAll("rect");
    expect(rects).toHaveLength(2);
    rects.forEach((rect) => {
      expect(rect).toHaveAttribute("fill", "#0A0A0A");
    });

    const path = container.querySelector("path");
    expect(path).toHaveAttribute("stroke", "#4976F4");

    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
    circles.forEach((circle) => {
      expect(circle).toHaveAttribute("fill", "#4976F4");
    });
  });

  it("renderiza barras brancas e detalhes azuis no tema dark", () => {
    const { container } = render(<NexoLogo theme="dark" />);
    const rects = container.querySelectorAll("rect");
    expect(rects).toHaveLength(2);
    rects.forEach((rect) => {
      expect(rect).toHaveAttribute("fill", "#FFFFFF");
    });

    const path = container.querySelector("path");
    expect(path).toHaveAttribute("stroke", "#4976F4");

    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
    circles.forEach((circle) => {
      expect(circle).toHaveAttribute("fill", "#4976F4");
    });
  });
});
