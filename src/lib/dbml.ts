import type {
  DatabaseColumn,
  DatabaseDiagramParseResult,
  DatabaseRecordColumn,
  DatabaseRecordSet,
  DatabaseRelation,
  DatabaseRelationKind,
  DatabaseSourceRange,
  DatabaseTable,
} from '../types/database';

const IGNORED_TABLE_BLOCK_KEYWORDS = new Set(['indexes', 'note']);

interface ParsedLine {
  text: string;
  start: number;
}

interface TrimmedLine {
  text: string;
  start: number;
}

interface CommaPart {
  value: string;
  start: number;
  end: number;
}

interface ParsedEndpoint {
  table: string;
  column: string;
  tableRange?: DatabaseSourceRange;
  columnRange?: DatabaseSourceRange;
}

interface ColumnLineParse {
  column: DatabaseColumn | null;
  error: string | null;
}

function maskWithSpaces(value: string): string {
  return value.replace(/[^\r\n]/g, ' ');
}

// Keep offsets intact so visual renames can safely patch the original DBML.
const DBML_STRING_OR_COMMENT = /'''[\s\S]*?'''|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g;

function maskComments(content: string): string {
  return content.replace(DBML_STRING_OR_COMMENT, (token) =>
    token.startsWith('/') ? maskWithSpaces(token) : token);
}

function maskStrings(content: string): string {
  return content.replace(DBML_STRING_OR_COMMENT, maskWithSpaces);
}

function splitLinesWithStart(content: string, baseStart = 0): ParsedLine[] {
  const parts = content.split(/(\r\n|\n|\r)/);
  const lines: ParsedLine[] = [];
  let offset = baseStart;

  for (let index = 0; index < parts.length; index += 2) {
    const text = parts[index] ?? '';
    const newline = parts[index + 1] ?? '';
    if (text === '' && newline === '' && index === parts.length - 1) {
      break;
    }
    lines.push({ text, start: offset });
    offset += text.length + newline.length;
  }

  return lines;
}

function trimLine(line: ParsedLine): TrimmedLine | null {
  const first = line.text.search(/\S/);
  if (first === -1) {
    return null;
  }
  const end = line.text.search(/\s*$/);
  const textEnd = end === -1 ? line.text.length : end;
  return {
    text: line.text.slice(first, textEnd),
    start: line.start + first,
  };
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readToken(value: string): string | null {
  return value.match(/^("[^"]+"|'[^']+'|\S+)/)?.[0] ?? null;
}

function splitTopLevelCommaWithRanges(
  value: string,
  baseStart = 0,
): CommaPart[] {
  const parts: CommaPart[] = [];
  let quote: '"' | "'" | null = null;
  let depth = 0;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    const ch = value[index];
    if (quote) {
      if (ch === quote && value[index - 1] !== '\\') {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === ')' || ch === ']' || ch === '}') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (ch === ',' && depth === 0) {
      parts.push({
        value: value.slice(start, index),
        start: baseStart + start,
        end: baseStart + index,
      });
      start = index + 1;
    }
  }

  parts.push({
    value: value.slice(start),
    start: baseStart + start,
    end: baseStart + value.length,
  });

  return parts
    .map((part) => {
      const leading = part.value.search(/\S/);
      if (leading === -1) {
        return null;
      }
      const trailing = part.value.search(/\s*$/);
      const end = trailing === -1 ? part.value.length : trailing;
      return {
        value: part.value.slice(leading, end),
        start: part.start + leading,
        end: part.start + end,
      };
    })
    .filter((part): part is CommaPart => part !== null);
}

function splitTopLevelComma(value: string): string[] {
  return splitTopLevelCommaWithRanges(value).map((part) => part.value.trim());
}

function parseFlags(rawFlags: string): {
  isPrimaryKey: boolean;
  isNotNull: boolean;
  note?: string;
} {
  let isPrimaryKey = false;
  let isNotNull = false;
  let note: string | undefined;

  for (const rawPart of splitTopLevelComma(rawFlags)) {
    const part = rawPart.trim();
    const lower = part.toLowerCase();
    if (lower === 'pk' || lower === 'primary key') {
      isPrimaryKey = true;
    } else if (lower === 'not null') {
      isNotNull = true;
    } else if (lower.startsWith('note:')) {
      note = unquote(part.slice(part.indexOf(':') + 1));
    }
  }

  return { isPrimaryKey, isNotNull, note };
}

function countBraceDelta(value: string): number {
  let delta = 0;
  for (const ch of value) {
    if (ch === '{') {
      delta += 1;
    } else if (ch === '}') {
      delta -= 1;
    }
  }
  return delta;
}

function findMatchingBrace(content: string, openIndex: number): number {
  content = maskStrings(content);
  let depth = 0;
  for (let index = openIndex; index < content.length; index += 1) {
    const ch = content[index];
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function parseColumnLine(
  line: TrimmedLine,
  tableId: string,
  index: number,
): ColumnLineParse {
  const flagStart = line.text.indexOf('[');
  let head = line.text;
  let flagsRaw = '';

  if (flagStart !== -1) {
    const flagEnd = line.text.lastIndexOf(']');
    if (flagEnd > flagStart) {
      flagsRaw = line.text.slice(flagStart + 1, flagEnd);
      head = line.text.slice(0, flagStart).trimEnd();
    }
  }

  const nameToken = readToken(head.trimStart());
  if (!nameToken) {
    return { column: null, error: `Coluna inválida: "${line.text}"` };
  }
  const nameOffset = head.indexOf(nameToken);
  const typeStartOffset = nameOffset + nameToken.length;
  const type = head.slice(typeStartOffset).trim();
  if (!type) {
    return { column: null, error: `Coluna inválida: "${line.text}"` };
  }

  const typeOffset = head.indexOf(type, typeStartOffset);
  const { isPrimaryKey, isNotNull, note } = parseFlags(flagsRaw);
  const name = unquote(nameToken);

  return {
    column: {
      id: `${tableId}.${name}-${index}`,
      name,
      type,
      isPrimaryKey,
      isNotNull,
      note,
      sourceRange: {
        start: line.start,
        end: line.start + line.text.length,
      },
      nameSourceRange: {
        start: line.start + nameOffset,
        end: line.start + nameOffset + nameToken.length,
      },
      typeSourceRange: {
        start: line.start + typeOffset,
        end: line.start + typeOffset + type.length,
      },
    },
    error: null,
  };
}

function parseTables(masked: string, errors: string[]): DatabaseTable[] {
  const tables: DatabaseTable[] = [];
  const tableRegex = /\bTable\s+("[^"]+"|'[^']+'|[A-Za-z_][\w.]*)/gi;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(masked)) !== null) {
    const rawName = match[1];
    const nameOffset = match[0].indexOf(rawName);
    const nameStart = match.index + nameOffset;
    const openBrace = masked.indexOf('{', tableRegex.lastIndex);
    if (openBrace === -1) {
      errors.push(`Tabela "${unquote(rawName)}" sem corpo`);
      continue;
    }
    const closeBrace = findMatchingBrace(masked, openBrace);
    if (closeBrace === -1) {
      errors.push(`Tabela "${unquote(rawName)}" sem fechamento`);
      continue;
    }

    const tableName = unquote(rawName);
    const rawBody = masked.slice(openBrace + 1, closeBrace);
    const tableNotePattern = /(?:^|\n)[\t ]*Note\s*(?::|\{)\s*('''[\s\S]*?'''|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\s*\}?/gi;
    const rawNote = [...rawBody.matchAll(tableNotePattern)][0]?.[1];
    const note = rawNote?.startsWith("'''") ? rawNote.slice(3, -3).trim() : rawNote ? unquote(rawNote) : undefined;
    const body = rawBody.replace(tableNotePattern, maskWithSpaces);
    const columns: DatabaseColumn[] = [];
    let columnIndex = 0;
    let skipDepth = 0;

    for (const rawLine of splitLinesWithStart(body, openBrace + 1)) {
      const line = trimLine(rawLine);
      if (!line) {
        continue;
      }
      if (skipDepth > 0) {
        skipDepth += countBraceDelta(line.text);
        continue;
      }

      const firstToken = line.text.toLowerCase().split(/\s|\{|\[|:/)[0];
      if (IGNORED_TABLE_BLOCK_KEYWORDS.has(firstToken)) {
        skipDepth = Math.max(0, countBraceDelta(line.text));
        continue;
      }

      const { column, error } = parseColumnLine(line, tableName, columnIndex);
      columnIndex += 1;
      if (column) {
        columns.push(column);
      } else if (error) {
        errors.push(error);
      }
    }

    tables.push({
      id: tableName,
      name: tableName,
      columns,
      note,
      sourceRange: { start: match.index, end: closeBrace + 1 },
      nameSourceRange: {
        start: nameStart,
        end: nameStart + rawName.length,
      },
    });
    tableRegex.lastIndex = closeBrace + 1;
  }

  return tables;
}

function parseRecordColumns(rawColumns: string, start: number): DatabaseRecordColumn[] {
  return splitTopLevelCommaWithRanges(rawColumns, start).map((part) => ({
    name: unquote(part.value),
    sourceRange: { start: part.start, end: part.end },
  }));
}

function parseRecordRows(body: string, bodyStart: number): string[][] {
  const rows: string[][] = [];
  for (const rawLine of splitLinesWithStart(body, bodyStart)) {
    const line = trimLine(rawLine);
    if (!line) {
      continue;
    }
    const normalized = line.text.endsWith(',')
      ? line.text.slice(0, -1)
      : line.text;
    rows.push(splitTopLevelComma(normalized).map(unquote));
  }
  return rows;
}

function parseRecords(masked: string): DatabaseRecordSet[] {
  const records: DatabaseRecordSet[] = [];
  const recordsRegex =
    /\bRecords\s+("[^"]+"|'[^']+'|[A-Za-z_][\w.]*)\s*\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;

  while ((match = recordsRegex.exec(masked)) !== null) {
    const rawTableName = match[1];
    const rawColumns = match[2];
    const tableNameOffset = match[0].indexOf(rawTableName);
    const columnsStart =
      match.index + match[0].indexOf(rawColumns, tableNameOffset);
    const tableNameStart = match.index + tableNameOffset;
    const openBrace = masked.indexOf('{', recordsRegex.lastIndex);
    if (openBrace === -1) {
      continue;
    }
    const closeBrace = findMatchingBrace(masked, openBrace);
    if (closeBrace === -1) {
      continue;
    }

    records.push({
      tableName: unquote(rawTableName),
      columns: parseRecordColumns(rawColumns, columnsStart),
      rows: parseRecordRows(masked.slice(openBrace + 1, closeBrace), openBrace + 1),
      sourceRange: { start: match.index, end: closeBrace + 1 },
      tableNameSourceRange: {
        start: tableNameStart,
        end: tableNameStart + rawTableName.length,
      },
    });
    recordsRegex.lastIndex = closeBrace + 1;
  }

  return records;
}

function parseEndpoint(raw: string, rawStart: number): ParsedEndpoint | null {
  const parts = raw.split('.');
  if (parts.length < 2) {
    return null;
  }
  const rawColumn = parts[parts.length - 1];
  const rawTable = parts.slice(0, -1).join('.');
  const columnStart = rawStart + rawTable.length + 1;

  return {
    table: parts.slice(0, -1).map(unquote).join('.'),
    column: unquote(rawColumn),
    tableRange: { start: rawStart, end: rawStart + rawTable.length },
    columnRange: {
      start: columnStart,
      end: columnStart + rawColumn.length,
    },
  };
}

function relationKind(operator: string): DatabaseRelationKind {
  if (operator === '>') {
    return 'many';
  }
  if (operator === '<') {
    return 'one';
  }
  return 'oneToOne';
}

function cardinalityLabels(operator: string): {
  from: string;
  to: string;
} {
  if (operator === '>') {
    return { from: '*', to: '0..1' };
  }
  if (operator === '<') {
    return { from: '0..1', to: '*' };
  }
  return { from: '1', to: '1' };
}

function buildRelation(args: {
  name?: string;
  leftRaw: string;
  operator: string;
  rightRaw: string;
  leftStart: number;
  rightStart: number;
  sourceRange: DatabaseSourceRange;
  index: number;
}): DatabaseRelation | null {
  const from = parseEndpoint(args.leftRaw, args.leftStart);
  const to = parseEndpoint(args.rightRaw, args.rightStart);
  if (!from || !to) {
    return null;
  }
  const labels = cardinalityLabels(args.operator);
  return {
    id:
      args.name ??
      `${from.table}.${from.column}-${args.operator}-${to.table}.${to.column}-${args.index}`,
    name: args.name,
    fromTable: from.table,
    fromColumn: from.column,
    toTable: to.table,
    toColumn: to.column,
    kind: relationKind(args.operator),
    cardinalityLabelFrom: labels.from,
    cardinalityLabelTo: labels.to,
    sourceRange: args.sourceRange,
    fromTableSourceRange: from.tableRange,
    fromColumnSourceRange: from.columnRange,
    toTableSourceRange: to.tableRange,
    toColumnSourceRange: to.columnRange,
  };
}

function parseRelations(masked: string, errors: string[]): DatabaseRelation[] {
  const relations: DatabaseRelation[] = [];
  const directRefRegex =
    /\bRef(?:\s+([A-Za-z_][\w]*))?\s*:\s*("[^"]+"|'[^']+'|[\w.]+)\s*([<>\-])\s*("[^"]+"|'[^']+'|[\w.]+)/gi;
  let match: RegExpExecArray | null;

  while ((match = directRefRegex.exec(masked)) !== null) {
    const [, name, leftRaw, operator, rightRaw] = match;
    const source = match[0];
    const leftOffset = source.indexOf(leftRaw);
    const rightOffset = source.indexOf(rightRaw, leftOffset + leftRaw.length);
    const relation = buildRelation({
      name,
      leftRaw,
      operator,
      rightRaw,
      leftStart: match.index + leftOffset,
      rightStart: match.index + rightOffset,
      sourceRange: { start: match.index, end: match.index + source.length },
      index: relations.length,
    });
    if (relation) {
      relations.push(relation);
    } else {
      errors.push(`Ref inválida: "${source.trim()}"`);
    }
  }

  const blockRefRegex = /\bRef(?:\s+([A-Za-z_][\w]*))?\s*\{/gi;
  const endpointRegex =
    /("[^"]+"|'[^']+'|[\w.]+)\s*([<>\-])\s*("[^"]+"|'[^']+'|[\w.]+)/g;
  while ((match = blockRefRegex.exec(masked)) !== null) {
    const openBrace = masked.indexOf('{', match.index);
    const closeBrace = findMatchingBrace(masked, openBrace);
    if (openBrace === -1 || closeBrace === -1) {
      continue;
    }
    const body = masked.slice(openBrace + 1, closeBrace);
    let endpointMatch: RegExpExecArray | null;
    while ((endpointMatch = endpointRegex.exec(body)) !== null) {
      const [, leftRaw, operator, rightRaw] = endpointMatch;
      const leftOffset = endpointMatch.index;
      const rightOffset = body.indexOf(
        rightRaw,
        leftOffset + leftRaw.length,
      );
      const relation = buildRelation({
        name: match[1],
        leftRaw,
        operator,
        rightRaw,
        leftStart: openBrace + 1 + leftOffset,
        rightStart: openBrace + 1 + rightOffset,
        sourceRange: {
          start: openBrace + 1 + endpointMatch.index,
          end: openBrace + 1 + endpointMatch.index + endpointMatch[0].length,
        },
        index: relations.length,
      });
      if (relation) {
        relations.push(relation);
      }
    }
    blockRefRegex.lastIndex = closeBrace + 1;
  }

  return relations;
}

function markForeignKeys(
  tables: DatabaseTable[],
  relations: DatabaseRelation[],
): void {
  const tableMap = new Map(tables.map((table) => [table.name, table]));

  for (const relation of relations) {
    const foreignSide =
      relation.kind === 'one'
        ? {
            table: relation.toTable,
            column: relation.toColumn,
            targetTable: relation.fromTable,
            targetColumn: relation.fromColumn,
          }
        : {
            table: relation.fromTable,
            column: relation.fromColumn,
            targetTable: relation.toTable,
            targetColumn: relation.toColumn,
          };
    const column = tableMap
      .get(foreignSide.table)
      ?.columns.find((entry) => entry.name === foreignSide.column);
    if (!column) {
      continue;
    }
    column.isForeignKey = true;
    column.references = [
      ...(column.references ?? []),
      { table: foreignSide.targetTable, column: foreignSide.targetColumn },
    ];
  }
}

export function isValidDbmlIdentifier(value: string): boolean {
  return /^[A-Za-z_][\w.]*$/.test(value.trim());
}

export function isValidDbmlColumnIdentifier(value: string): boolean {
  return /^[A-Za-z_]\w*$/.test(value.trim());
}

function applyReplacements(
  content: string,
  replacements: { range: DatabaseSourceRange; value: string }[],
): string {
  const sorted = [...replacements].sort((a, b) => b.range.start - a.range.start);
  let next = content;
  let lastStart = Number.POSITIVE_INFINITY;

  for (const replacement of sorted) {
    if (replacement.range.end > lastStart) {
      continue;
    }
    next =
      next.slice(0, replacement.range.start) +
      replacement.value +
      next.slice(replacement.range.end);
    lastStart = replacement.range.start;
  }

  return next;
}

export function renameDbmlTable(
  content: string,
  currentName: string,
  nextName: string,
): string {
  const normalized = nextName.trim();
  if (
    !normalized ||
    normalized === currentName ||
    !isValidDbmlIdentifier(normalized)
  ) {
    return content;
  }

  const parsed = parseDbml(content);
  const replacements: { range: DatabaseSourceRange; value: string }[] = [];

  for (const table of parsed.tables) {
    if (table.name === currentName && table.nameSourceRange) {
      replacements.push({ range: table.nameSourceRange, value: normalized });
    }
  }
  for (const group of parsed.groups) {
    for (const member of group.tables) {
      if (member.name === currentName && member.sourceRange) {
        replacements.push({ range: member.sourceRange, value: normalized });
      }
    }
  }
  for (const record of parsed.records) {
    if (record.tableName === currentName && record.tableNameSourceRange) {
      replacements.push({
        range: record.tableNameSourceRange,
        value: normalized,
      });
    }
  }
  for (const relation of parsed.relations) {
    if (relation.fromTable === currentName && relation.fromTableSourceRange) {
      replacements.push({
        range: relation.fromTableSourceRange,
        value: normalized,
      });
    }
    if (relation.toTable === currentName && relation.toTableSourceRange) {
      replacements.push({
        range: relation.toTableSourceRange,
        value: normalized,
      });
    }
  }

  return applyReplacements(content, replacements);
}

export function renameDbmlColumn(
  content: string,
  tableName: string,
  currentName: string,
  nextName: string,
): string {
  const normalized = nextName.trim();
  if (
    !normalized ||
    normalized === currentName ||
    !isValidDbmlColumnIdentifier(normalized)
  ) {
    return content;
  }

  const parsed = parseDbml(content);
  const replacements: { range: DatabaseSourceRange; value: string }[] = [];
  const table = parsed.tables.find((entry) => entry.name === tableName);

  for (const column of table?.columns ?? []) {
    if (column.name === currentName && column.nameSourceRange) {
      replacements.push({ range: column.nameSourceRange, value: normalized });
    }
  }
  for (const record of parsed.records) {
    if (record.tableName !== tableName) {
      continue;
    }
    for (const column of record.columns) {
      if (column.name === currentName && column.sourceRange) {
        replacements.push({ range: column.sourceRange, value: normalized });
      }
    }
  }
  for (const relation of parsed.relations) {
    if (
      relation.fromTable === tableName &&
      relation.fromColumn === currentName &&
      relation.fromColumnSourceRange
    ) {
      replacements.push({
        range: relation.fromColumnSourceRange,
        value: normalized,
      });
    }
    if (
      relation.toTable === tableName &&
      relation.toColumn === currentName &&
      relation.toColumnSourceRange
    ) {
      replacements.push({
        range: relation.toColumnSourceRange,
        value: normalized,
      });
    }
  }

  return applyReplacements(content, replacements);
}

function parseAnnotations(content: string, errors: string[]) {
  const groups: DatabaseDiagramParseResult['groups'] = [];
  const notes: DatabaseDiagramParseResult['notes'] = [];
  const enums: DatabaseDiagramParseResult['enums'] = [];
  const regex = /\b(TableGroup|Enum|Note)\s+("[^"]+"|[\w.]+)\s*(?:\[([^\]]*)\])?\s*\{/gi;
  let core = content;
  const structuralContent = maskStrings(content);
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content))) {
    // Ignore constructs embedded inside strings (including sticky-note examples).
    if (!structuralContent.slice(match.index, match.index + match[1].length).trim()) continue;
    const end = findMatchingBrace(content, regex.lastIndex - 1);
    if (end < 0) {
      errors.push(`${match[1]} "${match[2]}" sem fechamento`);
      continue;
    }
    const body = content.slice(regex.lastIndex, end);
    const name = unquote(match[2]);
    const color = match[3]?.match(/color\s*:\s*(#[0-9a-f]{6}|#[0-9a-f]{3})\b/i)?.[1];
    const notePattern = /\bNote\s*(?::|\{)\s*('''[\s\S]*?'''|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")\s*\}?/gi;
    const noteValue = (value: string) => value.startsWith("'''") ? value.slice(3, -3).trim() : unquote(value);
    if (match[1].toLowerCase() === 'note') {
      notes.push({ name, text: noteValue(body.trim()), color });
    } else if (match[1].toLowerCase() === 'enum') {
      enums.push({ name, values: splitLinesWithStart(body).flatMap((line) => {
        const token = readToken(line.text.trim());
        return token ? [unquote(token)] : [];
      }) });
    } else {
      const note = [...body.matchAll(notePattern)][0]?.[1] ?? match[3]?.match(/note\s*:\s*('[^']*'|"[^"]*")/i)?.[1];
      const members = body.replace(notePattern, maskWithSpaces);
      groups.push({ name, color, note: note ? noteValue(note) : undefined,
        tables: splitLinesWithStart(members, regex.lastIndex).flatMap((line) => {
          const trimmed = trimLine(line);
          return trimmed ? [{ name: unquote(trimmed.text), sourceRange: { start: trimmed.start, end: trimmed.start + trimmed.text.length } }] : [];
        }) });
    }
    core = core.slice(0, match.index) + maskWithSpaces(content.slice(match.index, end + 1)) + core.slice(end + 1);
    regex.lastIndex = end + 1;
  }
  return { core, groups, notes, enums };
}

export function parseDbml(content: string): DatabaseDiagramParseResult {
  const errors: string[] = [];
  const { core: masked, groups, notes, enums } = parseAnnotations(maskComments(content), errors);
  const tables = parseTables(masked, errors);
  const records = parseRecords(masked);
  const relations = parseRelations(masked, errors);
  const tableMap = new Map(tables.map((table) => [table.name, table]));

  for (const record of records) {
    const table = tableMap.get(record.tableName);
    if (table) {
      table.records = record;
    }
  }

  markForeignKeys(tables, relations);

  return { tables, relations, records, errors, groups, notes, enums };
}
