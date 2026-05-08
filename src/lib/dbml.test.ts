import { describe, expect, it } from 'vitest';
import { parseDbml } from './dbml';

describe('parseDbml', () => {
  it('parseia tabelas com colunas e flags', () => {
    const result = parseDbml(`
      Table users {
        id integer [primary key]
        username varchar
        role varchar [not null]
      }
    `);

    expect(result.tables).toHaveLength(1);
    const table = result.tables[0];
    expect(table.name).toBe('users');
    expect(table.columns).toHaveLength(3);
    expect(table.columns[0]).toMatchObject({ name: 'id', type: 'integer', isPrimaryKey: true });
    expect(table.columns[2]).toMatchObject({ name: 'role', isNotNull: true });
    expect(result.errors).toEqual([]);
  });

  it('parseia refs com >, < e -', () => {
    const result = parseDbml(`
      Table a { id integer }
      Table b { id integer }
      Ref: a.id > b.id
      Ref: a.id < b.id
      Ref: a.id - b.id
    `);

    expect(result.relations.map((r) => r.kind)).toEqual(['many', 'one', 'oneToOne']);
    expect(result.relations[0]).toMatchObject({
      fromTable: 'a',
      fromColumn: 'id',
      toTable: 'b',
      toColumn: 'id',
    });
  });

  it('cobre o caso de exemplo (users/posts/follows)', () => {
    const result = parseDbml(`
      Table users {
        id integer [primary key]
        username varchar
      }
      Table posts {
        id integer [primary key]
        user_id integer [not null]
      }
      Table follows {
        following_user_id integer
        followed_user_id integer
      }
      Ref: posts.user_id > users.id
      Ref: follows.following_user_id > users.id
      Ref: follows.followed_user_id > users.id
    `);

    expect(result.tables.map((t) => t.name)).toEqual(['users', 'posts', 'follows']);
    expect(result.relations).toHaveLength(3);
    expect(result.errors).toEqual([]);
  });

  it('ignora blocos não suportados sem quebrar', () => {
    const result = parseDbml(`
      Project meu_projeto {
        database_type: 'PostgreSQL'
      }
      Enum status_type {
        ativo
        inativo
      }
      Table users {
        id integer [pk]
        Indexes {
          (id) [unique]
        }
      }
      TableGroup grupo {
        users
      }
    `);

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].columns).toHaveLength(1);
    expect(result.tables[0].columns[0].isPrimaryKey).toBe(true);
  });

  it('tolera linhas inválidas acumulando erros', () => {
    const result = parseDbml(`
      Table users {
        id
        valid integer
      }
      Ref: malformado
    `);

    expect(result.tables[0].columns.map((c) => c.name)).toEqual(['valid']);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('aceita comentários de linha e bloco', () => {
    const result = parseDbml(`
      // comentário
      /* bloco
         multi-linha */
      Table users {
        id integer [pk] // comentário inline
      }
    `);

    expect(result.tables).toHaveLength(1);
    expect(result.tables[0].columns[0].name).toBe('id');
  });
});
