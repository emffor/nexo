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
  headerColor?: string;
  note?: string;
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

export interface DatabaseTableGroup {
  name: string;
  tables: DatabaseRecordColumn[];
  note?: string;
  color?: string;
}

export interface DatabaseStickyNote {
  name: string;
  text: string;
  color?: string;
}

export interface DatabaseEnum {
  name: string;
  values: string[];
}

export interface DatabaseDiagramParseResult {
  groups: DatabaseTableGroup[];
  notes: DatabaseStickyNote[];
  enums: DatabaseEnum[];
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

export type DatabaseRelationSide = 'left' | 'right';

export interface DatabaseRelationPathPoint {
  x: number;
  y: number;
}

export interface DatabaseRelationPathState {
  fromSide: DatabaseRelationSide;
  toSide: DatabaseRelationSide;
  points: DatabaseRelationPathPoint[];
}

export interface DatabaseDiagramVisualState {
  positions: Record<string, DatabaseTablePosition>;
  collapsedGroups?: string[];
  notePositions?: Record<string, DatabaseTablePosition>;
  relationPaths?: Record<string, DatabaseRelationPathState>;
  viewport?: DatabaseDiagramViewport;
}

export interface DatabaseDiagramRecord {
  id: string;
  projectId?: string;
  title: string;
  content: string;
  state: DatabaseDiagramVisualState;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_DATABASE_DBML = `Table usuarios {
  id integer [primary key]
  nome varchar
  email varchar
  criado_em timestamp
}

Table produtos {
  id integer [primary key]
  usuario_id integer [not null]
  nome varchar
  preco decimal
  status varchar
  criado_em timestamp
}

Table pedidos {
  id integer [primary key]
  usuario_id integer [not null]
  produto_id integer [not null]
  quantidade integer
  total decimal
  status varchar
  criado_em timestamp
}

Ref: produtos.usuario_id > usuarios.id

Ref: pedidos.usuario_id > usuarios.id
Ref: pedidos.produto_id > produtos.id
`;
