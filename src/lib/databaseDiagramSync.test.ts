import { DB_TABLE_WIDTH, DB_HEADER_HEIGHT, DB_ROW_HEIGHT } from './databaseLayout';
import { describe, expect, it } from 'vitest';
import {
  reanchorRelationPathsForMovedTable,
  reconcileDatabaseVisualState,
  remapDatabaseVisualStateForColumnRename,
  remapDatabaseVisualStateForTableRename,
} from './databaseDiagramSync';
import type {
  DatabaseColumn,
  DatabaseRelation,
  DatabaseTable,
} from '../types/database';

function column(name: string, index: number): DatabaseColumn {
  return {
    id: `${name}-${index}`,
    name,
    type: 'integer',
    isPrimaryKey: index === 0,
    isNotNull: false,
  };
}

function table(name: string, columns: string[]): DatabaseTable {
  return {
    id: name,
    name,
    columns: columns.map(column),
  };
}

function relation(
  id: string,
  fromTable: string,
  fromColumn: string,
  toTable: string,
  toColumn: string,
): DatabaseRelation {
  return {
    id,
    fromTable,
    fromColumn,
    toTable,
    toColumn,
    kind: 'many',
  };
}

describe('databaseDiagramSync', () => {
  it('preserva estado visual quando o DBML esta invalido', () => {
    const state = {
      positions: {
        users: { x: 40, y: 40 },
        ghost: { x: 500, y: 500 },
      },
      relationPaths: {
        old: {
          fromSide: 'right' as const,
          toSide: 'left' as const,
          points: [
            { x: 280, y: 45 },
            { x: 360, y: 45 },
          ],
        },
      },
    };

    const next = reconcileDatabaseVisualState({
      state,
      tables: [table('users', ['id'])],
      relations: [],
      isDbmlValid: false,
      canPruneOrphans: true,
    });

    expect(next).toBe(state);
  });

  it('adiciona tabelas novas e limpa orfaos somente quando valido', () => {
    const validRelation = relation(
      'posts.user_id->users.id-0',
      'posts',
      'user_id',
      'users',
      'id',
    );
    const state = {
      positions: {
        users: { x: 40, y: 40 },
        ghost: { x: 500, y: 500 },
      },
      relationPaths: {
        [validRelation.id]: {
          fromSide: 'left' as const,
          toSide: 'right' as const,
          points: [
            { x: 360, y: 71 },
            { x: 280, y: 45 },
          ],
        },
        old: {
          fromSide: 'right' as const,
          toSide: 'left' as const,
          points: [
            { x: 10, y: 10 },
            { x: 20, y: 20 },
          ],
        },
      },
    };

    const next = reconcileDatabaseVisualState({
      state,
      tables: [table('users', ['id']), table('posts', ['id', 'user_id'])],
      relations: [validRelation],
      isDbmlValid: true,
      canPruneOrphans: true,
    });

    expect(next.positions.users).toBe(state.positions.users);
    expect(next.positions.posts).toEqual(expect.any(Object));
    expect(next.positions.ghost).toBeUndefined();
    expect(next.relationPaths?.[validRelation.id]).toBe(
      state.relationPaths[validRelation.id],
    );
    expect(next.relationPaths?.old).toBeUndefined();
  });

  it('remapeia posicao e caminho manual ao renomear tabela', () => {
    const previousRelation = relation(
      'posts.user_id->users.id-0',
      'posts',
      'user_id',
      'users',
      'id',
    );
    const nextRelation = relation(
      'posts.user_id->accounts.id-0',
      'posts',
      'user_id',
      'accounts',
      'id',
    );
    const state = {
      positions: { users: { x: 40, y: 40 } },
      relationPaths: {
        [previousRelation.id]: {
          fromSide: 'left' as const,
          toSide: 'right' as const,
          points: [
            { x: 360, y: 71 },
            { x: 280, y: 45 },
          ],
        },
      },
    };

    const next = remapDatabaseVisualStateForTableRename({
      state,
      previousRelations: [previousRelation],
      nextRelations: [nextRelation],
      currentName: 'users',
      nextName: 'accounts',
    });

    expect(next.positions.accounts).toBe(state.positions.users);
    expect(next.positions.users).toBeUndefined();
    expect(next.relationPaths?.[nextRelation.id]).toBe(
      state.relationPaths[previousRelation.id],
    );
  });

  it('remapeia caminho manual ao renomear coluna', () => {
    const previousRelation = relation(
      'posts.user_id->users.id-0',
      'posts',
      'user_id',
      'users',
      'id',
    );
    const nextRelation = relation(
      'posts.author_id->users.id-0',
      'posts',
      'author_id',
      'users',
      'id',
    );
    const state = {
      positions: {
        posts: { x: 360, y: 40 },
        users: { x: 40, y: 40 },
      },
      relationPaths: {
        [previousRelation.id]: {
          fromSide: 'left' as const,
          toSide: 'right' as const,
          points: [
            { x: 360, y: 71 },
            { x: 280, y: 45 },
          ],
        },
      },
    };

    const next = remapDatabaseVisualStateForColumnRename({
      state,
      previousRelations: [previousRelation],
      nextRelations: [nextRelation],
      tableName: 'posts',
      currentName: 'user_id',
      nextName: 'author_id',
    });

    expect(next.relationPaths?.[nextRelation.id]).toBe(
      state.relationPaths[previousRelation.id],
    );
    expect(next.relationPaths?.[previousRelation.id]).toBeUndefined();
  });

  it('reancora caminho manual ao mover tabela conectada', () => {
    const users = table('users', ['id']);
    const posts = table('posts', ['id', 'user_id']);
    const rel = relation(
      'posts.user_id->users.id-0',
      'posts',
      'user_id',
      'users',
      'id',
    );
    const state = {
      positions: {
        users: { x: 40, y: 40 },
        posts: { x: 500, y: 40 },
      },
      relationPaths: {
        [rel.id]: {
          fromSide: 'left' as const,
          toSide: 'right' as const,
          points: [
            { x: 500, y: 40 + DB_HEADER_HEIGHT + DB_ROW_HEIGHT * 1.5 },
            { x: 420, y: 40 + DB_HEADER_HEIGHT + DB_ROW_HEIGHT * 1.5 },
            { x: 420, y: 40 + DB_HEADER_HEIGHT + DB_ROW_HEIGHT / 2 },
            { x: 40 + DB_TABLE_WIDTH, y: 40 + DB_HEADER_HEIGHT + DB_ROW_HEIGHT / 2 },
          ],
        },
      },
    };

    const next = reanchorRelationPathsForMovedTable({
      state,
      tables: [users, posts],
      relations: [rel],
      tableId: 'users',
      nextPosition: { x: 40, y: 80 },
    });

    expect(next.relationPaths?.[rel.id]?.points).toEqual([
      { x: 500, y: 40 + DB_HEADER_HEIGHT + DB_ROW_HEIGHT * 1.5 },
      { x: 420, y: 40 + DB_HEADER_HEIGHT + DB_ROW_HEIGHT * 1.5 },
      { x: 420, y: 80 + DB_HEADER_HEIGHT + DB_ROW_HEIGHT / 2 },
      { x: 40 + DB_TABLE_WIDTH, y: 80 + DB_HEADER_HEIGHT + DB_ROW_HEIGHT / 2 },
    ]);
  });
});
