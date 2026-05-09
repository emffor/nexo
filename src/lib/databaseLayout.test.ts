import { describe, expect, it } from 'vitest';
import type { DatabaseRelation, DatabaseTable } from '../types/database';
import { computeDatabaseAutoLayoutByAlgorithm } from './databaseLayout';

function table(name: string): DatabaseTable {
  return {
    id: name,
    name,
    columns: [
      {
        id: `${name}.id`,
        name: 'id',
        type: 'integer',
        isPrimaryKey: true,
        isNotNull: true,
      },
    ],
  };
}

function relation(
  id: string,
  fromTable: string,
  toTable: string,
): DatabaseRelation {
  return {
    id,
    fromTable,
    fromColumn: 'id',
    toTable,
    toColumn: 'id',
    kind: 'many',
  };
}

describe('databaseLayout', () => {
  it('organiza left-right seguindo a direcao das relacoes', () => {
    const tables = [table('usuarios'), table('produtos'), table('pedidos')];
    const positions = computeDatabaseAutoLayoutByAlgorithm(
      tables,
      [
        relation('produtos-usuarios', 'produtos', 'usuarios'),
        relation('pedidos-produtos', 'pedidos', 'produtos'),
      ],
      'left-right',
    );

    expect(positions.pedidos.x).toBeLessThan(positions.produtos.x);
    expect(positions.produtos.x).toBeLessThan(positions.usuarios.x);
  });

  it('coloca a tabela mais conectada no centro do snowflake', () => {
    const tables = [
      table('usuarios'),
      table('produtos'),
      table('pedidos'),
      table('carros'),
    ];
    const positions = computeDatabaseAutoLayoutByAlgorithm(
      tables,
      [
        relation('produtos-usuarios', 'produtos', 'usuarios'),
        relation('pedidos-usuarios', 'pedidos', 'usuarios'),
        relation('carros-usuarios', 'carros', 'usuarios'),
      ],
      'snowflake',
    );

    const surrounding = [positions.produtos, positions.pedidos, positions.carros];
    expect(positions.usuarios.x).toBeGreaterThan(
      Math.min(...surrounding.map((position) => position.x)),
    );
    expect(positions.usuarios.x).toBeLessThan(
      Math.max(...surrounding.map((position) => position.x)),
    );
  });

  it('organiza compact em uma grade curta', () => {
    const tables = [table('a'), table('b'), table('c'), table('d')];
    const positions = computeDatabaseAutoLayoutByAlgorithm(tables, [], 'compact');

    expect(positions.a.y).toBe(positions.b.y);
    expect(positions.c.y).toBeGreaterThan(positions.a.y);
  });
});
