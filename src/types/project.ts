import type { DiagramState } from './diagram';

export interface Project {
  id: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  diagramState?: DiagramState;
  hiddenDiagramItemIds?: string[];
}
