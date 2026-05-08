import type { DiagramStatus } from './markdown';

export interface DiagramNodePosition {
  x: number;
  y: number;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
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
  { value: 'backlog', label: 'Backlog' },
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
    dark: { fill: '#3a4150', border: '#646b78', text: '#f1f5f9' },
    light: { fill: '#e5e7eb', border: '#9ca3af', text: '#0f172a' },
  },
  impedido: {
    dark: { fill: '#5b2a2f', border: '#b85a63', text: '#fee2e2' },
    light: { fill: '#fecaca', border: '#ef4444', text: '#7f1d1d' },
  },
  'em-desenvolvimento': {
    dark: { fill: '#1e3a5f', border: '#5fa8d3', text: '#dbeafe' },
    light: { fill: '#bfdbfe', border: '#3b82f6', text: '#0c4a6e' },
  },
  revisando: {
    dark: { fill: '#5c4a1f', border: '#d4a64a', text: '#fef3c7' },
    light: { fill: '#fde68a', border: '#f59e0b', text: '#78350f' },
  },
  finalizado: {
    dark: { fill: '#1f4d36', border: '#4ade80', text: '#dcfce7' },
    light: { fill: '#bbf7d0', border: '#22c55e', text: '#14532d' },
  },
};
