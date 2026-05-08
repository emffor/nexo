import { afterEach, describe, expect, it } from 'vitest';
import {
  clearDiagramState,
  readDiagramState,
  writeDiagramState,
} from './diagramState';

afterEach(() => {
  window.localStorage.clear();
});

describe('diagramState', () => {
  it('retorna estado vazio quando nao ha dados salvos', () => {
    const state = readDiagramState();
    expect(state.positions).toEqual({});
    expect(state.edges).toEqual([]);
  });

  it('persiste e recupera posicoes e edges', () => {
    writeDiagramState({
      positions: { a: { x: 10, y: 20 } },
      edges: [
        { id: 'e1', from: 'a', to: 'b', fromPort: 'top', toPort: 'bottom' },
      ],
      viewport: { x: -120, y: 80, scale: 0.75 },
    });

    const state = readDiagramState();
    expect(state.positions.a).toEqual({ x: 10, y: 20 });
    expect(state.edges).toHaveLength(1);
    expect(state.edges[0]).toMatchObject({
      from: 'a',
      to: 'b',
      fromPort: 'top',
      toPort: 'bottom',
    });
    expect(state.viewport).toEqual({ x: -120, y: 80, scale: 0.75 });
  });

  it('descarta entradas invalidas com seguranca', () => {
    window.localStorage.setItem(
      'organizar-markdown:diagram-state',
      JSON.stringify({
        positions: { a: { x: 'oops' }, b: { x: 1, y: 2 } },
        edges: [
          { id: 'e1', from: 'a', to: 'b', fromPort: 'right', toPort: 'nope' },
          { id: 5, from: 1 },
          null,
        ],
        viewport: { x: 1, y: 'oops', scale: 1 },
      }),
    );

    const state = readDiagramState();
    expect(state.positions).toEqual({ b: { x: 1, y: 2 } });
    expect(state.edges).toEqual([
      { id: 'e1', from: 'a', to: 'b', fromPort: 'right', toPort: undefined },
    ]);
    expect(state.viewport).toBeUndefined();
  });

  it('limpa o estado salvo', () => {
    writeDiagramState({ positions: { a: { x: 1, y: 1 } }, edges: [] });
    clearDiagramState();
    expect(readDiagramState().positions).toEqual({});
  });
});
