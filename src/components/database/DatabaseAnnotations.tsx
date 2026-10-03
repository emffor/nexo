'use client';

import { Group, Rect, Text } from 'react-konva';
import { DB_TABLE_WIDTH, computeDatabaseTableHeight } from '../../lib/databaseLayout';
import { databaseNotePosition, databaseNoteHeight } from '../../lib/databaseCanvas';
import type { DatabaseDiagramPanelProps } from '../../types/databaseCanvas';
import type { DatabaseTablePosition } from '../../types/database';

export function DatabaseAnnotations({ groups = [], notes = [], tables, state, onStateChange, positions, foreground }: Pick<DatabaseDiagramPanelProps, 'groups' | 'notes' | 'tables' | 'state' | 'onStateChange'> & { positions: Record<string, DatabaseTablePosition>; foreground: string }) {
  return <>
    {groups.map((group) => {
      const members = tables.filter((table) => group.tables.some((member) => member.name === table.name) && positions[table.id]);
      if (!members.length) return null;
      const x = Math.min(...members.map((table) => positions[table.id].x)) - 20;
      const y = Math.min(...members.map((table) => positions[table.id].y)) - (group.note ? 64 : 40);
      const width = Math.max(...members.map((table) => positions[table.id].x + DB_TABLE_WIDTH)) - x + 20;
      const height = Math.max(...members.map((table) => positions[table.id].y + computeDatabaseTableHeight(table.columns.length))) - y + 20;
      return <Group key={group.name} listening={false}>
        <Rect x={x} y={y} width={width} height={height} cornerRadius={8} fill={group.color ?? '#c4a34b'} opacity={0.1} />
        <Rect x={x} y={y} width={width} height={height} cornerRadius={8} stroke={group.color ?? '#c4a34b'} strokeWidth={1} />
        <Text x={x + 12} y={y + 12} width={width - 24} text={group.name} fontSize={13} fontStyle="bold" fill={foreground} />
        {group.note && <Text x={x + 12} y={y + 32} width={width - 24} height={24} ellipsis text={group.note} fontSize={11} fill={foreground} />}
      </Group>;
    })}
    {notes.map((note, index) => {
      const position = state.notePositions?.[note.name] ?? databaseNotePosition(positions, index);
      return <Group key={note.name} x={position.x} y={position.y} draggable onDragEnd={(event) => {
        event.cancelBubble = true;
        onStateChange({ ...state, notePositions: { ...state.notePositions, [note.name]: { x: event.target.x(), y: event.target.y() } } });
      }}>
        <Rect width={240} height={databaseNoteHeight(note.text)} cornerRadius={6} fill={note.color ?? '#f6e8b1'} stroke="#bca663" strokeWidth={1} />
        <Text x={12} y={12} width={216} text={note.name} fontSize={12} fontStyle="bold" fill="#332f20" />
        <Text x={12} y={38} width={216} text={note.text} fontSize={12} lineHeight={1.5} fill="#332f20" />
      </Group>;
    })}
  </>;
}
