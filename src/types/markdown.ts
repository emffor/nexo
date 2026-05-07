export interface MarkdownItem {
  id: string;
  title?: string;
  content: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface FlowLink {
  id: string;
  sourceId: string;
  targetId: string;
  createdAt: string;
  updatedAt: string;
}
