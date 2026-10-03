import type { DatabaseTable, DatabaseTableGroup, DatabaseTablePosition } from "../types/database";
import { DB_TABLE_WIDTH, computeDatabaseTableHeight } from "./databaseLayout";
import type { DatabaseAutoLayoutAlgorithm } from "./databaseLayout";

export const AUTO_LAYOUT_OPTIONS: {
  id: DatabaseAutoLayoutAlgorithm;
  label: string;
  description: string;
  shortcut: string;
  icon: "flow" | "snowflake" | "grid";
}[] = [
    {
      id: "left-right",
      label: "Esquerda-direita",
      description:
        "Organiza tabelas da esquerda para a direita com base na direção dos relacionamentos.",
      shortcut: "1",
      icon: "flow",
    },
    {
      id: "snowflake",
      label: "Floco de neve",
      description:
        "Mantém as tabelas mais conectadas no centro e distribui as demais ao redor.",
      shortcut: "2",
      icon: "snowflake",
    },
    {
      id: "compact",
      label: "Compacto",
      description:
        "Organiza tabelas em uma grade retangular curta para diagramas menores.",
      shortcut: "3",
      icon: "grid",
    },
  ];

export function databaseNotePosition(positions: Record<string, { x: number; y: number }>, index: number) {
  return { x: Math.max(0, ...Object.values(positions).map((position) => position.x + DB_TABLE_WIDTH)) + 60, y: 60 + index * 220 };
}

export function databaseNoteHeight(text: string) {
  return 54 + text.split('\n').reduce((count, line) => count + Math.max(1, Math.ceil(line.length / 28)), 0) * 18;
}


export function databaseColorText(color: string): string {
  const hex = color.replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex;
  const channels = [0, 2, 4].map((index) => parseInt(normalized.slice(index, index + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.179 ? '#17212b' : '#ffffff';
}


export function databaseGroupBounds(group: DatabaseTableGroup, tables: DatabaseTable[], positions: Record<string, DatabaseTablePosition>, collapsed: boolean) {
  const members = tables.filter((table) => group.tables.some((member) => member.name === table.name) && positions[table.id]);
  if (!members.length) return null;
  const x = Math.min(...members.map((table) => positions[table.id].x)) - 20;
  const y = Math.min(...members.map((table) => positions[table.id].y)) - (group.note ? 64 : 40);
  const width = Math.max(...members.map((table) => positions[table.id].x + DB_TABLE_WIDTH)) - x + 20;
  const height = collapsed ? (group.note ? 64 : 40) : Math.max(...members.map((table) => positions[table.id].y + computeDatabaseTableHeight(table.columns.length))) - y + 20;
  return { x, y, width, height };
}
