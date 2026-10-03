"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  readStoredTheme, readStoredViewMode, readStoredFontScale,
  readStoredPreviewMaximized, readStoredDiagramEdgeStyle,
  readStoredDatabaseEdgeStyle, STORAGE_KEYS,
} from "../lib/preferences";

function usePreferenceState() {
  const [theme, setTheme] = useState(readStoredTheme);
  const [viewMode, setViewMode] = useState(readStoredViewMode);
  const [fontScale, setFontScale] = useState(readStoredFontScale);
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(readStoredPreviewMaximized);
  const [diagramEdgeStyle, setDiagramEdgeStyle] = useState(readStoredDiagramEdgeStyle);
  const [databaseEdgeStyle, setDatabaseEdgeStyle] = useState(readStoredDatabaseEdgeStyle);

  useEffect(() => {
    const preferences = {
      theme, viewMode, fontScale, previewMaximized: isPreviewMaximized,
      diagramEdgeStyle, databaseEdgeStyle
    };
    for (const [key, value] of Object.entries(preferences)) {
      window.localStorage.setItem(STORAGE_KEYS[key as keyof typeof preferences], String(value));
    }
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    document.body.setAttribute("data-theme", theme);
  }, [theme, viewMode, fontScale, isPreviewMaximized, diagramEdgeStyle, databaseEdgeStyle]);

  return useMemo(() => ({
    theme, setTheme, viewMode, setViewMode, fontScale, setFontScale,
    isPreviewMaximized, setIsPreviewMaximized, diagramEdgeStyle, setDiagramEdgeStyle,
    databaseEdgeStyle, setDatabaseEdgeStyle
  }),
    [theme, viewMode, fontScale, isPreviewMaximized, diagramEdgeStyle, databaseEdgeStyle]);
}

const PreferencesContext = createContext<ReturnType<typeof usePreferenceState> | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const value = usePreferenceState();
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences requer PreferencesProvider");
  return value;
}
