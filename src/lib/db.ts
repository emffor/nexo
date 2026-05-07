import Dexie, { type Table } from 'dexie';
import type { FlowLink, MarkdownItem } from '../types/markdown';

class OrganizarMarkdownDatabase extends Dexie {
  items!: Table<MarkdownItem, string>;
  flowLinks!: Table<FlowLink, string>;

  constructor() {
    super('organizarMarkdown');

    this.version(1).stores({
      items: 'id, order, createdAt, updatedAt',
    });

    this.version(2).stores({
      items: 'id, order, createdAt, updatedAt',
    });

    this.version(3).stores({
      items: 'id, order, createdAt, updatedAt',
      flowLinks: 'id, sourceId, targetId, createdAt, updatedAt',
    });
  }
}

export const db = new OrganizarMarkdownDatabase();
