import Dexie, { type Table } from 'dexie';
import type { MarkdownItem } from '../types/markdown';
import type { DatabaseDiagramRecord } from '../types/database';
import type { Project } from '../types/project';

class OrganizarMarkdownDatabase extends Dexie {
  items!: Table<MarkdownItem, string>;
  databaseDiagrams!: Table<DatabaseDiagramRecord, string>;
  projects!: Table<Project, string>;

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
    });

    this.version(4).stores({
      items: 'id, order, createdAt, updatedAt, status',
    });

    this.version(5).stores({
      items: 'id, order, createdAt, updatedAt, status, observation',
    });

    this.version(6).stores({
      items: 'id, order, createdAt, updatedAt, status, observation',
      databaseDiagrams: 'id, updatedAt',
    });

    this.version(7).stores({
      items: 'id, projectId, [projectId+order], order, createdAt, updatedAt, status, observation',
      databaseDiagrams: 'id, projectId, updatedAt',
      projects: 'id, order, createdAt, updatedAt',
    });
  }
}

export const db = new OrganizarMarkdownDatabase();
