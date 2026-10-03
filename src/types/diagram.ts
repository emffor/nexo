import { UI_THEME } from "../lib/uiTheme";
import type { DiagramStatus } from './markdown';

export interface DiagramNodePosition {
  x: number;
  y: number;
}

export type DiagramPortSide = 'top' | 'right' | 'bottom' | 'left';

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  fromPort?: DiagramPortSide;
  toPort?: DiagramPortSide;
}

export interface DiagramViewport {
  x: number;
  y: number;
  scale: number;
}

export interface DiagramState {
  positions: Record<string, DiagramNodePosition>;
  edges: DiagramEdge[];
  viewport?: DiagramViewport;
}

export const DIAGRAM_STATUS_OPTIONS: { value: DiagramStatus; label: string }[] = [
  { value: 'backlog', label: 'Não iniciado' },
  { value: 'impedido', label: 'Impedido' },
  { value: 'em-desenvolvimento', label: 'Em Desenvolvimento' },
  { value: 'revisando', label: 'Revisando' },
  { value: 'finalizado', label: 'Finalizado' },
];

export interface DiagramStatusPalette {
  fill: string;
  border: string;
  text: string;
}

export const DIAGRAM_STATUS_PALETTE: Record<
  DiagramStatus,
  { dark: DiagramStatusPalette; light: DiagramStatusPalette }
> = {
  backlog: {
    dark: { fill: UI_THEME.dark.raised, border: UI_THEME.dark.muted, text: UI_THEME.dark.heading },
    light: { fill: UI_THEME.light.raised, border: UI_THEME.light.muted, text: UI_THEME.light.heading },
  },
  impedido: {
    dark: { fill: UI_THEME.dark.dangerSoft, border: UI_THEME.dark.danger, text: UI_THEME.dark.danger },
    light: { fill: UI_THEME.light.dangerSoft, border: UI_THEME.light.danger, text: UI_THEME.light.danger },
  },
  'em-desenvolvimento': {
    dark: { fill: UI_THEME.dark.accentSoft, border: UI_THEME.dark.accent, text: UI_THEME.dark.accent },
    light: { fill: UI_THEME.light.accentSoft, border: UI_THEME.light.accent, text: UI_THEME.light.accent },
  },
  revisando: {
    dark: { fill: UI_THEME.dark.warningSoft, border: UI_THEME.dark.warning, text: UI_THEME.dark.warning },
    light: { fill: UI_THEME.light.warningSoft, border: UI_THEME.light.warning, text: UI_THEME.light.warning },
  },
  finalizado: {
    dark: { fill: UI_THEME.dark.successSoft, border: UI_THEME.dark.success, text: UI_THEME.dark.success },
    light: { fill: UI_THEME.light.successSoft, border: UI_THEME.light.success, text: UI_THEME.light.success },
  },
};
