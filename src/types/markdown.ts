export type DiagramStatus =
  | 'backlog'
  | 'impedido'
  | 'em-desenvolvimento'
  | 'revisando'
  | 'finalizado';

export interface MarkdownItem {
  id: string;
  title?: string;
  content: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  status?: DiagramStatus;
}
