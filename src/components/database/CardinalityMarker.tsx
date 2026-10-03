import { Circle, Group, Line } from "react-konva";
import type { DatabaseRelationSide } from "../../types/database";
export function CardinalityMarker({
  anchor,
  side,
  label,
  color,
  strokeWidth,
  opacity,
}: {
  anchor: { x: number; y: number };
  side: DatabaseRelationSide;
  label: string | undefined;
  color: string;
  strokeWidth: number;
  opacity: number;
}) {
  if (!label) {
    return null;
  }
  const dir = side === "right" ? 1 : -1;
  const isMany = label === "*" || /n/i.test(label);
  const isOptional = /0/.test(label);

  if (isMany) {
    const tip = { x: anchor.x + dir * 14, y: anchor.y };
    const baseX = anchor.x;
    return (
      <Group listening={false}>
        <Line
          points={[tip.x, tip.y, baseX, anchor.y - 6]}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={opacity}
          lineCap="round"
          perfectDrawEnabled={false}
        />
        <Line
          points={[tip.x, tip.y, baseX, anchor.y]}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={opacity}
          lineCap="round"
          perfectDrawEnabled={false}
        />
        <Line
          points={[tip.x, tip.y, baseX, anchor.y + 6]}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={opacity}
          lineCap="round"
          perfectDrawEnabled={false}
        />
      </Group>
    );
  }

  const tickX = anchor.x + dir * (isOptional ? 14 : 10);
  return (
    <Group listening={false}>
      <Line
        points={[tickX, anchor.y - 5, tickX, anchor.y + 5]}
        stroke={color}
        strokeWidth={strokeWidth}
        opacity={opacity}
        lineCap="round"
        perfectDrawEnabled={false}
      />
      {isOptional ? (
        <Circle
          x={anchor.x + dir * 6}
          y={anchor.y}
          radius={3}
          stroke={color}
          strokeWidth={strokeWidth}
          opacity={opacity}
          perfectDrawEnabled={false}
        />
      ) : null}
    </Group>
  );
}
