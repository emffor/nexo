import type { AppTheme, DiagramEdgeStyle } from "../lib/preferences";
import type { DatabaseDiagramVisualState, DatabaseRelation, DatabaseRelationPathState, DatabaseTable, DatabaseTableGroup, DatabaseStickyNote, DatabaseEnum } from "./database";

export type ActiveEditor =
  | { type: "table"; tableId: string; draft: string; error: string | null }
  | {
    type: "column";
    tableId: string;
    columnName: string;
    draft: string;
    error: string | null;
  };

export type LiveTablePosition = {
  id: string;
  x: number;
  y: number;
};

export type LiveRelationPath = {
  relationId: string;
  path: DatabaseRelationPathState;
};

export type CurveDragSnapshot = {
  relationId: string;
  controlIndex: number;
  points: { x: number; y: number }[];
};

export interface DatabaseDiagramPanelProps {
  groups?: DatabaseTableGroup[];
  notes?: DatabaseStickyNote[];
  enums?: DatabaseEnum[];
  content?: string;
  onContentChange?: (content: string) => void;
  tables: DatabaseTable[];
  relations: DatabaseRelation[];
  theme: AppTheme;
  state: DatabaseDiagramVisualState;
  onStateChange: (state: DatabaseDiagramVisualState) => void;
  onRenameTable?: (tableName: string, nextName: string) => boolean;
  onRenameColumn?: (
    tableName: string,
    columnName: string,
    nextName: string,
  ) => boolean;
  edgeStyle?: DiagramEdgeStyle;
  resetSignal?: number;
}
