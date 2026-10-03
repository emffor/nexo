'use client';

import { Group, Rect, Text } from 'react-konva';
import { DatabaseCanvasIcon } from './DatabaseCanvasIcon';
import type { DatabaseColorTarget } from '../../lib/dbml';
import { databaseGroupBounds, databaseColorText, databaseNotePosition, databaseNoteHeight } from '../../lib/databaseCanvas';
import type { DatabaseDiagramPanelProps } from '../../types/databaseCanvas';
import type { DatabaseTablePosition } from '../../types/database';

export function DatabaseAnnotations({ groups = [], notes = [], tables, state, onStateChange, positions, foreground, onOpenColor, onToggleGroup }: Pick<DatabaseDiagramPanelProps, 'groups' | 'notes' | 'tables' | 'state' | 'onStateChange'> & { positions: Record<string, DatabaseTablePosition>; foreground: string; onOpenColor?: (target: DatabaseColorTarget) => void; onToggleGroup: (name: string) => void }) {
  return <>
    {groups.map((group) => {
      const collapsed = state.collapsedGroups?.includes(group.name) ?? false;
      const bounds = databaseGroupBounds(group, tables, positions, collapsed);
      if (!bounds) return null;
      const { x, y, width, height } = bounds;
      return <Group key={group.name}>
        <Rect x={x} y={y} width={width} height={height} cornerRadius={8} fill={group.color ?? '#c4a34b'} opacity={0.12} listening={false} />
        <Rect x={x} y={y} width={width} height={height} cornerRadius={8} stroke={group.color ?? '#c4a34b'} strokeWidth={1} listening={false} />
        <Text x={x + 12} y={y + 12} width={width - 56} text={`${collapsed ? "▸" : "▾"} ${group.name}`} onClick={(event) => { event.cancelBubble = true; onToggleGroup(group.name); }} onTap={(event) => { event.cancelBubble = true; onToggleGroup(group.name); }} fontSize={13} fontStyle="bold" fill={foreground} />
        {onOpenColor && <DatabaseCanvasIcon x={x + width - 36} y={y + 5} color={foreground} kind="palette" onClick={() => onOpenColor({ kind: 'TableGroup', name: group.name })} />}
        {group.note && <Text x={x + 12} y={y + 32} width={width - 24} height={24} ellipsis text={group.note} fontSize={11} fill={foreground} />}
      </Group>;
    })}
    {notes.map((note, index) => {
      const position = state.notePositions?.[note.name] ?? databaseNotePosition(positions, index);
      const noteColor = note.color ?? '#f6e8b1';
      const noteText = databaseColorText(noteColor);
      return <Group key={note.name} x={position.x} y={position.y} draggable onDragEnd={(event) => {
        event.cancelBubble = true;
        onStateChange({ ...state, notePositions: { ...state.notePositions, [note.name]: { x: event.target.x(), y: event.target.y() } } });
      }}>
        <Rect width={240} height={databaseNoteHeight(note.text)} cornerRadius={6} fill={noteColor} stroke="#bca663" strokeWidth={1} />
        <Rect width={240} height={32} fill={noteText} opacity={0.05} listening={false} />
        {onOpenColor && <DatabaseCanvasIcon x={208} y={2} color={noteText} kind="palette" onClick={() => onOpenColor({ kind: 'Note', name: note.name })} />}
        <Text x={12} y={12} width={190} text={note.name} fontSize={12} fontStyle="bold" fill={noteText} />
        <Text x={12} y={38} width={216} text={note.text} fontSize={12} lineHeight={1.5} fill={noteText} />
      </Group>;
    })}
  </>;
}
