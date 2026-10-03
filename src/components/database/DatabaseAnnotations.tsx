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
      const groupColor = group.color ?? '#f59e0b';
      return <Group key={group.name}>
        <Rect x={x} y={y} width={width} height={height} cornerRadius={12} fill={groupColor} opacity={0.16} listening={false} />
        <Rect x={x} y={y} width={width} height={height} cornerRadius={12} stroke={groupColor} strokeWidth={1.5} listening={false} />
        <Text x={x + 14} y={y + 12} width={width - 56} text={`${collapsed ? "▸" : "▾"} ${group.name}`} onClick={(event) => { event.cancelBubble = true; onToggleGroup(group.name); }} onTap={(event) => { event.cancelBubble = true; onToggleGroup(group.name); }} fontSize={13} fontStyle="bold" fill={group.color ? foreground : "#92400e"} />
        {onOpenColor && <DatabaseCanvasIcon x={x + width - 36} y={y + 8} color={foreground} kind="palette" onClick={() => onOpenColor({ kind: 'TableGroup', name: group.name })} />}
        {group.note && <Text x={x + 14} y={y + 30} width={width - 28} height={20} ellipsis text={group.note} fontSize={11} fill={group.color ? foreground : "#b45309"} />}
      </Group>;
    })}
    {notes.map((note, index) => {
      const position = state.notePositions?.[note.name] ?? databaseNotePosition(positions, index);
      const noteColor = note.color ?? '#fef08a';
      const noteText = note.color ? databaseColorText(noteColor) : '#713f12';
      return <Group key={note.name} x={position.x} y={position.y} draggable onDragEnd={(event) => {
        event.cancelBubble = true;
        onStateChange({ ...state, notePositions: { ...state.notePositions, [note.name]: { x: event.target.x(), y: event.target.y() } } });
      }}>
        <Rect width={240} height={databaseNoteHeight(note.text)} cornerRadius={8} fill={noteColor} stroke="#fde047" strokeWidth={1.2} shadowColor="#000000" shadowBlur={8} shadowOpacity={0.08} shadowOffsetY={2} />
        <Rect width={240} height={30} fill="#000000" opacity={0.04} cornerRadius={[8, 8, 0, 0]} listening={false} />
        {onOpenColor && <DatabaseCanvasIcon x={208} y={3} color={noteText} kind="palette" onClick={() => onOpenColor({ kind: 'Note', name: note.name })} />}
        <Text x={12} y={10} width={190} text={note.name} fontSize={12} fontStyle="bold" fill={noteText} />
        <Text x={12} y={38} width={216} text={note.text} fontSize={12} lineHeight={1.5} fill={noteText} />
      </Group>;
    })}
  </>;
}
