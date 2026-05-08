export interface DatabaseColumn {
  id: string;
  name: string;
  type: string;
  isPrimaryKey: boolean;
  isNotNull: boolean;
}

export interface DatabaseTable {
  id: string;
  name: string;
  columns: DatabaseColumn[];
}

export type DatabaseRelationKind = 'one' | 'many' | 'oneToOne';

export interface DatabaseRelation {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  kind: DatabaseRelationKind;
}

export interface DatabaseDiagramParseResult {
  tables: DatabaseTable[];
  relations: DatabaseRelation[];
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
