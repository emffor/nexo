import type {
  DatabaseColumn,
  DatabaseDiagramParseResult,
  DatabaseRelation,
  DatabaseRelationKind,
  DatabaseTable,
} from '../types/database';

const IGNORED_BLOCK_KEYWORDS = new Set([
  'enum',
  'tablegroup',
  'project',
  'note',
  'indexes',
  'records',
]);

function stripLineComment(line: string): string {
  const idx = line.indexOf('//');
  return idx === -1 ? line : line.slice(0, idx);
}

function removeBlockComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

function unquote(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseFlags(rawFlags: string): { isPrimaryKey: boolean; isNotNull: boolean } {
  const inner = rawFlags.trim();
  if (!inner) {
    return { isPrimaryKey: false, isNotNull: false };
  }
  const normalized = inner.toLowerCase();
  // separar por vírgula no nível 0
  const parts: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of normalized) {
    if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1;
    }
    if (ch === ',' && depth === 0) {
      parts.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) {
    parts.push(buf.trim());
  }

  let isPrimaryKey = false;
  let isNotNull = false;
  for (const part of parts) {
    if (part === 'pk' || part === 'primary key') {
      isPrimaryKey = true;
    } else if (part === 'not null') {
      isNotNull = true;
    }
  }
  return { isPrimaryKey, isNotNull };
}

interface ColumnLineParse {
  column: DatabaseColumn | null;
  error: string | null;
}

function parseColumnLine(line: string, tableId: string, index: number): ColumnLineParse {
  // formato: name type [flags...]
  const flagStart = line.indexOf('[');
  let head = line;
  let flagsRaw = '';
  if (flagStart !== -1) {
    const flagEnd = line.lastIndexOf(']');
    if (flagEnd > flagStart) {
      flagsRaw = line.slice(flagStart + 1, flagEnd);
      head = line.slice(0, flagStart).trim();
    }
  }

  const tokens = head.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return { column: null, error: `Coluna inválida: "${line}"` };
  }
  const name = unquote(tokens[0]);
  const type = tokens.slice(1).join(' ');
  const { isPrimaryKey, isNotNull } = parseFlags(flagsRaw);

  return {
    column: {
      id: `${tableId}.${name}-${index}`,
      name,
      type,
      isPrimaryKey,
      isNotNull,
    },
    error: null,
  };
}

function parseRefLine(line: string): { relation: DatabaseRelation | null; error: string | null } {
  // aceita: "Ref: a.x > b.y", "Ref name: a.x > b.y", "Ref { a.x > b.y }"
  const colonIdx = line.indexOf(':');
  let body = colonIdx !== -1 ? line.slice(colonIdx + 1) : line.replace(/^ref\s*/i, '');
  body = body.trim();
  if (body.startsWith('{') && body.endsWith('}')) {
    body = body.slice(1, -1).trim();
  }

  const match = body.match(/([\w".]+)\s*([<>\-])\s*([\w".]+)/);
  if (!match) {
    return { relation: null, error: `Ref inválida: "${line}"` };
  }
  const [, leftRaw, operator, rightRaw] = match;
  const left = leftRaw.split('.').map(unquote);
  const right = rightRaw.split('.').map(unquote);
  if (left.length !== 2 || right.length !== 2) {
    return { relation: null, error: `Ref inválida: "${line}"` };
  }

  let kind: DatabaseRelationKind;
  if (operator === '>') {
    kind = 'many';
  } else if (operator === '<') {
    kind = 'one';
  } else {
    kind = 'oneToOne';
  }

  return {
    relation: {
      id: `${left.join('.')}-${operator}-${right.join('.')}`,
      fromTable: left[0],
      fromColumn: left[1],
      toTable: right[0],
      toColumn: right[1],
      kind,
    },
    error: null,
  };
}

export function parseDbml(content: string): DatabaseDiagramParseResult {
  const tables: DatabaseTable[] = [];
  const relations: DatabaseRelation[] = [];
  const errors: string[] = [];

  const cleaned = removeBlockComments(content)
    .replace(/\{/g, '{\n')
    .replace(/\}/g, '\n}\n');
  const lines = cleaned.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];
    const line = stripLineComment(raw).trim();
    if (!line) {
      i += 1;
      continue;
    }

    const lower = line.toLowerCase();
    const firstToken = lower.split(/\s|\{|\[|:/)[0];

    // bloco a ignorar com chaves
    if (IGNORED_BLOCK_KEYWORDS.has(firstToken)) {
      // se a linha não abre bloco, descartamos só ela
      if (!line.includes('{')) {
        i += 1;
        continue;
      }
      // pular até o fechamento balanceado
      let depth = 0;
      while (i < lines.length) {
        const l = stripLineComment(lines[i]);
        for (const ch of l) {
          if (ch === '{') {
            depth += 1;
          } else if (ch === '}') {
            depth -= 1;
          }
        }
        i += 1;
        if (depth <= 0) {
          break;
        }
      }
      continue;
    }

    if (firstToken === 'ref') {
      // pode ser bloco multi-linha "Ref { ... }" ou linha única
      if (line.includes('{') && !line.includes('}')) {
        // coletar até "}"
        let buffer = line;
        i += 1;
        while (i < lines.length) {
          const l = stripLineComment(lines[i]);
          buffer += ` ${l.trim()}`;
          i += 1;
          if (l.includes('}')) {
            break;
          }
        }
        const { relation, error } = parseRefLine(buffer);
        if (relation) {
          relations.push(relation);
        } else if (error) {
          errors.push(error);
        }
        continue;
      }
      const { relation, error } = parseRefLine(line);
      if (relation) {
        relations.push(relation);
      } else if (error) {
        errors.push(error);
      }
      i += 1;
      continue;
    }

    if (firstToken === 'table') {
      // header pode ter "as alias" ou "[ ... ]"
      const headerMatch = line.match(/^table\s+([^\s\{\[]+)/i);
      if (!headerMatch) {
        errors.push(`Tabela sem nome: "${line}"`);
        i += 1;
        continue;
      }
      const tableName = unquote(headerMatch[1]);
      const tableId = tableName;

      // avançar até "{"
      let cursor = line;
      while (!cursor.includes('{') && i + 1 < lines.length) {
        i += 1;
        cursor = stripLineComment(lines[i]).trim();
      }
      if (!cursor.includes('{')) {
        errors.push(`Tabela "${tableName}" sem corpo`);
        i += 1;
        continue;
      }

      // a partir daqui, ler linhas até "}"
      i += 1;
      const columns: DatabaseColumn[] = [];
      let columnIndex = 0;
      while (i < lines.length) {
        const inner = stripLineComment(lines[i]).trim();
        if (!inner) {
          i += 1;
          continue;
        }
        if (inner.startsWith('}')) {
          i += 1;
          break;
        }
        // ignorar sub-blocos como Indexes { ... } ou Note { ... }
        const innerLower = inner.toLowerCase();
        const innerFirst = innerLower.split(/\s|\{|\[|:/)[0];
        if (IGNORED_BLOCK_KEYWORDS.has(innerFirst)) {
          if (inner.includes('{')) {
            let depth = 0;
            while (i < lines.length) {
              const l = stripLineComment(lines[i]);
              for (const ch of l) {
                if (ch === '{') {
                  depth += 1;
                } else if (ch === '}') {
                  depth -= 1;
                }
              }
              i += 1;
              if (depth <= 0) {
                break;
              }
            }
          } else {
            i += 1;
          }
          continue;
        }

        const { column, error } = parseColumnLine(inner, tableId, columnIndex);
        columnIndex += 1;
        if (column) {
          columns.push(column);
        } else if (error) {
          errors.push(error);
        }
        i += 1;
      }
      tables.push({ id: tableId, name: tableName, columns });
      continue;
    }

    // linha desconhecida, ignorar com erro leve
    errors.push(`Linha não suportada: "${line}"`);
    i += 1;
  }

  // filtrar relações cujas tabelas/colunas existem; manter mesmo que não existam?
  // Aqui, mantemos todas para não esconder problemas; o renderer pode pular as órfãs.
  return { tables, relations, errors };
}
