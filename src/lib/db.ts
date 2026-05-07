import Dexie, { type Table } from 'dexie';
import type { MarkdownItem } from '../types/markdown';

class OrganizarMarkdownDatabase extends Dexie {
  items!: Table<MarkdownItem, string>;

  constructor() {
    super('organizarMarkdown');

    this.version(1).stores({
      items: 'id, order, createdAt, updatedAt',
    });

    this.version(2).stores({
      items: 'id, order, createdAt, updatedAt',
    });
  }
}

export const db = new OrganizarMarkdownDatabase();
