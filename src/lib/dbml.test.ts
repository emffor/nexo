import { describe, expect, it } from 'vitest';
import { parseDbml, renameDbmlColumn, renameDbmlTable, setDbmlColor } from './dbml';

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
    expect(result.relations.map((r) => r.cardinalityLabelTo)).toEqual(['0..1', '*', '1']);
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

  it('parseia refs nomeadas e marca chave estrangeira', () => {
    const result = parseDbml(`
      Table users { id integer [pk] }
      Table posts { user_id integer [not null] }
      Ref user_posts: posts.user_id > users.id
    `);

    expect(result.relations[0]).toMatchObject({
      id: 'user_posts',
      name: 'user_posts',
      cardinalityLabelFrom: '*',
      cardinalityLabelTo: '0..1',
    });
    expect(result.tables[1].columns[0]).toMatchObject({
      name: 'user_id',
      isForeignKey: true,
      references: [{ table: 'users', column: 'id' }],
    });
  });

  it('parseia records e associa a tabela', () => {
    const result = parseDbml(`
      Table users {
        id integer [pk]
        username varchar
      }

      Records users(id, username) {
        1, 'Ada'
        2, 'Grace'
      }
    `);

    expect(result.records).toHaveLength(1);
    expect(result.records[0].columns.map((column) => column.name)).toEqual([
      'id',
      'username',
    ]);
    expect(result.records[0].rows).toEqual([
      ['1', 'Ada'],
      ['2', 'Grace'],
    ]);
    expect(result.tables[0].records?.rows).toHaveLength(2);
  });

  it('renomeia tabela atualizando refs e records', () => {
    const content = `
      Table users {
        id integer [pk]
      }
      Table posts {
        user_id integer
      }
      Ref user_posts: posts.user_id > users.id
      Records users(id) {
        1
      }
    `;

    const renamed = renameDbmlTable(content, 'users', 'accounts');

    expect(renamed).toContain('Table accounts');
    expect(renamed).toContain('posts.user_id > accounts.id');
    expect(renamed).toContain('Records accounts(id)');
    expect(renamed).not.toContain('Table users');
  });

  it('renomeia coluna atualizando refs e records', () => {
    const content = `
      Table users {
        id integer [pk]
      }
      Table posts {
        user_id integer
      }
      Ref user_posts: posts.user_id > users.id
      Records posts(user_id) {
        1
      }
    `;

    const renamed = renameDbmlColumn(content, 'posts', 'user_id', 'author_id');

    expect(renamed).toContain('author_id integer');
    expect(renamed).toContain('posts.author_id > users.id');
    expect(renamed).toContain('Records posts(author_id)');
    expect(renamed).not.toContain('user_id integer');
  });
});

it('interpreta grupos, enums e notas multilinha sem confundir exemplos com tabelas', () => {
  const content = `Enum prec_status {
    rascunho
    "em revisão"
  }
  Table prec_servicos { id bigint [pk] }
  TableGroup precificacao [color: #e8c45a] {
    prec_servicos
    Note: 'Tabelas do módulo'
  }
  Note lembrete {
    '''Veja https://example.com
    Table falsa { id int }
    Revise as chaves'''
  }`;
  const parsed = parseDbml(content);
  expect(parsed.errors).toEqual([]);
  expect(parsed.tables.map((table) => table.name)).toEqual(['prec_servicos']);
  expect(parsed.enums[0].values).toEqual(['rascunho', 'em revisão']);
  expect(parsed.groups[0]).toMatchObject({ name: 'precificacao', color: '#e8c45a', note: 'Tabelas do módulo', tables: [{ name: 'prec_servicos' }] });
  expect(parsed.notes[0].text).toContain('https://example.com');
  const renamed = renameDbmlTable(content, 'prec_servicos', 'servicos');
  expect(parseDbml(renamed).groups[0].tables[0].name).toBe('servicos');
  expect(parseDbml(renamed).notes).toEqual(parsed.notes);
});

it('reporta anotações incompletas durante a edição', () => {
  expect(parseDbml('TableGroup vendas {\n users').errors).toContain('TableGroup "vendas" sem fechamento');
});

it('preserva notas multilinha de tabela e offsets para renomear colunas', () => {
  const content = `Table users {
  Note: '''Dados {internos}
  Consulte https://example.com'''
  id int [pk]
  nome varchar [note: 'Nome público']
}`;
  const parsed = parseDbml(content);
  expect(parsed.errors).toEqual([]);
  expect(parsed.tables[0].note).toContain('https://example.com');
  expect(parsed.tables[0].columns.map((column) => column.name)).toEqual(['id', 'nome']);
  expect(renameDbmlColumn(content, 'users', 'nome', 'name')).toContain("name varchar [note: 'Nome público']");
});


it('altera e remove cores preservando notas, aliases, campos e referências', () => {
  const source = `Table "public.users" as U [note: 'a, b', headercolor : #abc] {
 id int [pk]
}
Ref: public.users.id > orders.user_id`;
  const target = { kind: 'Table' as const, name: 'public.users' };
  const colored = setDbmlColor(source, target, '#334155');
  expect(colored).toContain("[note: 'a, b', headercolor: #334155]");
  expect(parseDbml(colored).tables[0].headerColor).toBe('#334155');
  expect(setDbmlColor(colored, target, null)).toContain("[note: 'a, b']");
  expect(colored).toContain('Ref: public.users.id > orders.user_id');
  expect(setDbmlColor(source, target, 'invalid')).toBe(source);
});

it('persiste cores de grupos e notas e ignora exemplos dentro de strings', () => {
  const source = `Note exemplo { 'Table users { id int }' }
Table users { id int }
TableGroup vendas {
 users
}`;
  const table = setDbmlColor(source, { kind: 'Table', name: 'users' }, '#dbeafe');
  expect(table).toContain("Note exemplo { 'Table users { id int }' }");
  const group = setDbmlColor(table, { kind: 'TableGroup', name: 'vendas' }, '#fed7aa');
  const note = setDbmlColor(group, { kind: 'Note', name: 'exemplo' }, '#ede9fe');
  expect(parseDbml(note).groups[0].color).toBe('#fed7aa');
  expect(parseDbml(note).notes[0].color).toBe('#ede9fe');
  expect(parseDbml(setDbmlColor(note, { kind: 'Table', name: 'users' }, null)).tables[0].headerColor).toBeUndefined();
});

it('não interpreta menções a cores em notas como configurações e preserva delimitadores citados', () => {
  const source = `Table users [note: 'Use [headercolor: #abc] neste exemplo'] { id int }`;
  expect(parseDbml(source).tables[0].headerColor).toBeUndefined();
  const next = setDbmlColor(source, { kind: 'Table', name: 'users' }, '#fed7aa');
  expect(next).toContain("[note: 'Use [headercolor: #abc] neste exemplo', headercolor: #fed7aa]");
  expect(parseDbml(next).tables[0].headerColor).toBe('#fed7aa');
});
