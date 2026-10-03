"use client";

import { PreferencesProvider } from "./contexts/PreferencesContext";
import { ProjectsScreen } from "./components/ProjectsScreen";

export default function App() {
  return (
    <PreferencesProvider>
      <ProjectsScreen />
    </PreferencesProvider>
  );
}
