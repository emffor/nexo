import {
  DIAGRAM_NODE_HEIGHT,
  DIAGRAM_NODE_WIDTH
} from "../lib/diagramLayout";
import type {
  DiagramNodePosition,
  DiagramPortSide
} from "../types/diagram";
const PORT_DIRECTIONS: Record<DiagramPortSide, { x: number; y: number }> = { top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 } };
export function getPortPosition(
  position: DiagramNodePosition,
  side: DiagramPortSide,
): { x: number; y: number } {
  if (side === "top") {
    return { x: position.x + DIAGRAM_NODE_WIDTH / 2, y: position.y };
  }
  if (side === "right") {
    return {
      x: position.x + DIAGRAM_NODE_WIDTH,
      y: position.y + DIAGRAM_NODE_HEIGHT / 2,
    };
  }
  if (side === "bottom") {
    return {
      x: position.x + DIAGRAM_NODE_WIDTH / 2,
      y: position.y + DIAGRAM_NODE_HEIGHT,
    };
  }
  return { x: position.x, y: position.y + DIAGRAM_NODE_HEIGHT / 2 };
}

export function getCurveEdgePoints(
  fromPosition: DiagramNodePosition,
  fromPort: DiagramPortSide,
  toPosition: DiagramNodePosition,
  toPort: DiagramPortSide,
): number[] {
  const from = getPortPosition(fromPosition, fromPort);
  const to = getPortPosition(toPosition, toPort);
  const fromDirection = PORT_DIRECTIONS[fromPort];
  const toDirection = PORT_DIRECTIONS[toPort];
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const controlOffset = Math.max(72, Math.min(180, distance * 0.45));
  const fromControl = {
    x: from.x + fromDirection.x * controlOffset,
    y: from.y + fromDirection.y * controlOffset,
  };
  const toControl = {
    x: to.x + toDirection.x * controlOffset,
    y: to.y + toDirection.y * controlOffset,
  };

  return [
    from.x,
    from.y,
    fromControl.x,
    fromControl.y,
    toControl.x,
    toControl.y,
    to.x,
    to.y,
  ];
}

export function getSquareEdgePoints(
  fromPosition: DiagramNodePosition,
  fromPort: DiagramPortSide,
  toPosition: DiagramNodePosition,
  toPort: DiagramPortSide,
): number[] {
  const from = getPortPosition(fromPosition, fromPort);
  const to = getPortPosition(toPosition, toPort);
  const fromDirection = PORT_DIRECTIONS[fromPort];
  const toDirection = PORT_DIRECTIONS[toPort];
  const offset = 36;
  const fromHandle = {
    x: from.x + fromDirection.x * offset,
    y: from.y + fromDirection.y * offset,
  };
  const toHandle = {
    x: to.x + toDirection.x * offset,
    y: to.y + toDirection.y * offset,
  };
  const fromIsVertical = fromDirection.y !== 0;
  const toIsVertical = toDirection.y !== 0;

  if (fromIsVertical && toIsVertical) {
    const trackY = (fromHandle.y + toHandle.y) / 2;
    return [
      from.x,
      from.y,
      fromHandle.x,
      fromHandle.y,
      fromHandle.x,
      trackY,
      toHandle.x,
      trackY,
      toHandle.x,
      toHandle.y,
      to.x,
      to.y,
    ];
  }

  if (!fromIsVertical && !toIsVertical) {
    const trackX = (fromHandle.x + toHandle.x) / 2;
    return [
      from.x,
      from.y,
      fromHandle.x,
      fromHandle.y,
      trackX,
      fromHandle.y,
      trackX,
      toHandle.y,
      toHandle.x,
      toHandle.y,
      to.x,
      to.y,
    ];
  }

  const corner = fromIsVertical
    ? { x: fromHandle.x, y: toHandle.y }
    : { x: toHandle.x, y: fromHandle.y };

  return [
    from.x,
    from.y,
    fromHandle.x,
    fromHandle.y,
    corner.x,
    corner.y,
    toHandle.x,
    toHandle.y,
    to.x,
    to.y,
  ];
}
