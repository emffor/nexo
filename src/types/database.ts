export interface DatabaseSourceRange {
  start: number;
  end: number;
}

export interface DatabaseReferenceTarget {
  table: string;
  column: string;
}

export interface DatabaseColumn {
  id: string;
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isNotNull: boolean;
  isForeignKey?: boolean;
  references?: DatabaseReferenceTarget[];
  note?: string;
  sourceRange?: DatabaseSourceRange;
  nameSourceRange?: DatabaseSourceRange;
  typeSourceRange?: DatabaseSourceRange;
}

export interface DatabaseRecordColumn {
  name: string;
  sourceRange?: DatabaseSourceRange;
}

export interface DatabaseRecordSet {
  tableName: string;
  columns: DatabaseRecordColumn[];
  rows: string[][];
  sourceRange?: DatabaseSourceRange;
  tableNameSourceRange?: DatabaseSourceRange;
}

export interface DatabaseTable {
  id: string;
  name: string;
  columns: DatabaseColumn[];
  records?: DatabaseRecordSet;
  sourceRange?: DatabaseSourceRange;
  nameSourceRange?: DatabaseSourceRange;
}

export type DatabaseRelationKind = 'one' | 'many' | 'oneToOne';

export interface DatabaseRelation {
  id: string;
  name?: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  kind: DatabaseRelationKind;
  cardinalityLabelFrom?: string;
  cardinalityLabelTo?: string;
  sourceRange?: DatabaseSourceRange;
  fromTableSourceRange?: DatabaseSourceRange;
  fromColumnSourceRange?: DatabaseSourceRange;
  toTableSourceRange?: DatabaseSourceRange;
  toColumnSourceRange?: DatabaseSourceRange;
}

export interface DatabaseDiagramParseResult {
  tables: DatabaseTable[];
  relations: DatabaseRelation[];
  records: DatabaseRecordSet[];
  errors: string[];
}

export interface DatabaseTablePosition {
  x: number;
  y: number;
}

export interface DatabaseDiagramViewport {
  x: number;
  y: number;
  scale: number;
}

export interface DatabaseDiagramVisualState {
  positions: Record<string, DatabaseTablePosition>;
  viewport?: DatabaseDiagramViewport;
}

export interface DatabaseDiagramRecord {
  id: string;
  title: string;
  content: string;
  state: DatabaseDiagramVisualState;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_DATABASE_DBML = `// Use DBML para definir o schema do seu banco
// Docs: https://dbml.dbdiagram.io/docs

Table users {
  id integer [primary key]
  username varchar
  role varchar
  created_at timestamp
}

Table posts {
  id integer [primary key]
  title varchar
  body text
  user_id integer [not null]
  status varchar
  created_at timestamp
}

Table follows {
  following_user_id integer
  followed_user_id integer
  created_at timestamp
}

Ref: posts.user_id > users.id
Ref: follows.following_user_id > users.id
Ref: follows.followed_user_id > users.id
`;
