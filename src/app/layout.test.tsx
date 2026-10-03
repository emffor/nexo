import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UI_THEME_CSS } from "../lib/uiTheme";
import RootLayout from "./layout";

describe("RootLayout", () => {
  it("preserva os tokens CSS no HTML inicial, sem entidades que quebrem o tema ou a hidratação", () => {
    const markup = renderToStaticMarkup(<RootLayout><main>Nexo</main></RootLayout>);
    const page = new DOMParser().parseFromString(markup, "text/html");

    expect(page.head.querySelector("style")?.textContent).toBe(UI_THEME_CSS);
  });
});
