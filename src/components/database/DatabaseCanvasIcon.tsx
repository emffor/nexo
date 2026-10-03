'use client';

import { Circle, Group, Path, Rect, Text } from 'react-konva';

export function DatabaseCanvasIcon({ x, y, color, kind, onClick }: {
  x: number; y: number; color: string; kind: 'palette' | 'note'; onClick: () => void;
}) {
  return <Group x={x} y={y} onClick={(event) => { event.cancelBubble = true; onClick(); }} onTap={(event) => { event.cancelBubble = true; onClick(); }}
    onMouseEnter={(event) => { const stage = event.target.getStage(); if (stage) stage.container().style.cursor = 'pointer'; }}
    onMouseLeave={(event) => { const stage = event.target.getStage(); if (stage) stage.container().style.cursor = 'default'; }}>
    <Rect width={28} height={28} fill="rgba(0,0,0,0)" />
    {kind === 'palette' ? <>
      <Path x={4} y={4} data="M10 1a9 9 0 1 0 0 18h1a2 2 0 0 0 1-3.7 1.2 1.2 0 0 1 .7-2.2H15a4 4 0 0 0 4-4A9 9 0 0 0 10 1Z" stroke={color} strokeWidth={1.5} listening={false} />
      {[[7, 11], [10, 7], [15, 7], [18, 11]].map(([cx, cy]) => <Circle key={`${cx}-${cy}`} x={cx} y={cy} radius={1.2} fill={color} listening={false} />)}
    </> : <Text x={5} y={6} text="▤" fontSize={19} fill={color} listening={false} />}
  </Group>;
}
