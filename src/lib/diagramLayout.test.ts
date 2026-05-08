import { describe, expect, it } from 'vitest';
import {
  DIAGRAM_GRID_OFFSET,
  DIAGRAM_NODE_HEIGHT,
  DIAGRAM_NODE_WIDTH,
  computeAutoLayout,
  snapToGrid,
} from './diagramLayout';

describe('computeAutoLayout', () => {
  it('distribui ids em grade horizontal segundo a quantidade de colunas', () => {
    const positions = computeAutoLayout(['a', 'b', 'c', 'd', 'e'], 4);

    expect(positions.a).toEqual({
      x: DIAGRAM_GRID_OFFSET,
      y: DIAGRAM_GRID_OFFSET,
    });
    expect(positions.d.x).toBeGreaterThan(positions.a.x);
    expect(positions.e.y).toBeGreaterThan(positions.a.y);
    expect(positions.e.x).toBe(DIAGRAM_GRID_OFFSET);
  });

  it('respeita as dimensoes dos nos para calcular o passo do grid', () => {
    const positions = computeAutoLayout(['a', 'b'], 1);
    expect(positions.b.y - positions.a.y).toBeGreaterThanOrEqual(
      DIAGRAM_NODE_HEIGHT,
    );

    const horizontal = computeAutoLayout(['a', 'b'], 2);
    expect(horizontal.b.x - horizontal.a.x).toBeGreaterThanOrEqual(
      DIAGRAM_NODE_WIDTH,
    );
  });

  it('retorna mapa vazio quando nao ha ids', () => {
    expect(computeAutoLayout([], 4)).toEqual({});
  });
});

describe('snapToGrid', () => {
  it('arredonda para o multiplo mais proximo', () => {
    expect(snapToGrid(11, 10)).toBe(10);
    expect(snapToGrid(15, 10)).toBe(20);
    expect(snapToGrid(-3, 10)).toBe(-0);
  });
});
