import type { RefObject } from "react";
import type { AppTheme, DiagramEdgeStyle } from "../lib/preferences";
import type { DiagramState } from "./diagram";
import type { DiagramStatus, MarkdownItem } from "./markdown";

export interface DiagramPanelProps {
  items: MarkdownItem[];
  theme: AppTheme;
  activeItemId: string | null;
  hiddenItemIds?: Set<string>;
  edgeStyle?: DiagramEdgeStyle;
  onSelectItem: (item: MarkdownItem) => void;
  onChangeStatus: (itemId: string, status: DiagramStatus | undefined) => void;
  scrollContainerRef?: RefObject<HTMLDivElement>;
  resetLayoutSignal?: number;
  clearEdgesSignal?: number;
  reloadStateSignal?: number;
  initialState?: DiagramState;
  onDiagramStateChange?: (state: DiagramState) => void;
}
