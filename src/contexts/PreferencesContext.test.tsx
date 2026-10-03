import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PreferencesProvider, usePreferences } from "./PreferencesContext";
import { STORAGE_KEYS } from "../lib/preferences";

function PreferencesConsumer() {
  const { theme, setTheme, viewMode, setViewMode } = usePreferences();
  return <>
    <span>{theme}:{viewMode}</span>
    <button onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}>Tema</button>
    <button onClick={() => setViewMode("database")}>Banco</button>
  </>;
}

describe("PreferencesProvider", () => {
  it("compartilha e persiste preferências entre consumidores", () => {
    window.localStorage.setItem(STORAGE_KEYS.theme, "light");
    render(<PreferencesProvider><PreferencesConsumer /><PreferencesConsumer /></PreferencesProvider>);
    expect(screen.getAllByText("light:normal")).toHaveLength(2);
    fireEvent.click(screen.getAllByText("Tema")[0]);
    fireEvent.click(screen.getAllByText("Banco")[1]);
    expect(screen.getAllByText("dark:database")).toHaveLength(2);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(STORAGE_KEYS.viewMode)).toBe("database");
  });
});
