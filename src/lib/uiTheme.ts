import type { AppTheme } from "./preferences";

export const UI_FONT_FAMILY = "Inter, sans-serif";
export const UI_RADIUS = 4;
export const UI_CODE_FONT_FAMILY = "ui-monospace, monospace";

// O dark é uma adaptação do Venture; ambos usam os mesmos papéis semânticos.
export const UI_THEME = {
  light: {
    canvas: "#f7f7f7", surface: "#ffffff", raised: "#f0f0f0",
    primary: "#000000", onPrimary: "#ffffff", primaryHover: "#333333",
    tag: "#4976f4", tagBg: "#edf2fe",
    heading: "#000000", text: "#4d4d4d", muted: "#707070", line: "#e5e5e5",
    accent: "#3d63d0", accentSoft: "#edf2fe",
    glass: "rgba(255,255,255,0.96)", selected: "#000000", onSelected: "#ffffff",
    danger: "#af4b4b", dangerSoft: "#fbefef", dangerHover: "#933e3e", onDanger: "#ffffff",
    success: "#377e58", successSoft: "#edf6f0",
    warning: "#946c21", warningSoft: "#faf4e8",
    overlay: "rgba(0,0,0,0.45)", shadowColor: "#000000",
    shadow: "0 2px 8px rgba(0,0,0,0.04)", shadowStrong: "0 12px 32px rgba(0,0,0,0.14)",
    scrollbar: "#bcbcbc", scrollbarHover: "#929292", edge: "#8a8a8a",
  },
  dark: {
    canvas: "#141414", surface: "#1e1e1e", raised: "#292929",
    primary: "#f5f5f5", onPrimary: "#141414", primaryHover: "#dddddd",
    tag: "#9bb5ff", tagBg: "#242f4a",
    heading: "#f5f5f5", text: "#d0d0d0", muted: "#a3a3a3", line: "#383838",
    accent: "#9bb5ff", accentSoft: "#242f4a",
    glass: "rgba(30,30,30,0.96)", selected: "#f5f5f5", onSelected: "#141414",
    danger: "#efa0a0", dangerSoft: "#3a2424", dangerHover: "#cf7777", onDanger: "#141414",
    success: "#8fc7a7", successSoft: "#22362b",
    warning: "#d7b879", warningSoft: "#383020",
    overlay: "rgba(0,0,0,0.65)", shadowColor: "#000000",
    shadow: "0 2px 8px rgba(0,0,0,0.16)", shadowStrong: "0 12px 32px rgba(0,0,0,0.4)",
    scrollbar: "#555555", scrollbarHover: "#777777", edge: "#808080",
  },
} satisfies Record<AppTheme, Record<string, string>>;

function themeDeclarations(theme: AppTheme): string {
  return Object.entries(UI_THEME[theme])
    .map(([name, value]) => `--ui-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}:${value};`)
    .join("");
}

export const UI_THEME_CSS = `:root{--ui-font-family:${UI_FONT_FAMILY};--ui-code-font-family:${UI_CODE_FONT_FAMILY};--ui-radius:${UI_RADIUS}px;}\n:root,[data-theme=light]{${themeDeclarations("light")}}\n[data-theme=dark]{${themeDeclarations("dark")}}`;
