import { fireEvent, render, screen } from '@testing-library/react';
import { forwardRef, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { isDatabasePathBlocked } from '../lib/databaseRouting';
import { DIAGRAM_NODE_WIDTH, DIAGRAM_NODE_HEIGHT } from '../lib/diagramLayout';
import type { MarkdownItem } from '../types/markdown';

vi.mock('react-konva', () => {
  const stageRefValue = {
    position: vi.fn(),
    scale: vi.fn(),
    batchDraw: vi.fn(),
  };

  const passthrough = forwardRef<HTMLDivElement, { children?: ReactNode }>(
    function Passthrough({ children }, ref) {
      return <div ref={ref}>{children}</div>;
    },
  );

  const stage = forwardRef<HTMLDivElement, { children?: ReactNode }>(
    function Stage({ children }, ref) {
      if (typeof ref === 'function') {
        ref(stageRefValue as unknown as HTMLDivElement);
      } else if (ref) {
        ref.current = stageRefValue as unknown as HTMLDivElement;
      }
      return <div>{children}</div>;
    },
  );

  const textNode = ({ text }: { text?: string }) => <span>{text}</span>;

  return {
    Stage: stage,
    Layer: passthrough,
    Group: ({ children, x, y, draggable }: { children?: ReactNode; x?: number; y?: number; draggable?: boolean }) =>
      <div data-testid={draggable ? 'node' : undefined} data-x={x} data-y={y}>{children}</div>,
    Rect: () => <div data-testid="rect" />,
    Circle: () => <div data-testid="port" />,
    Arrow: ({ points, bezier, onClick }: { points: number[]; bezier?: boolean; onClick?: () => void }) =>
      <div data-testid="arrow" data-points={JSON.stringify(points)} data-bezier={String(Boolean(bezier))} onClick={onClick} />,
    Path: ({ data, onClick }: { data: string; onClick?: () => void }) =>
      <div data-testid="path" data-path={data} onClick={onClick} />,
    Text: textNode,
  };
});

import DiagramPanel from './DiagramPanel';

function buildItem(id: string, title: string): MarkdownItem {
  return {
    id,
    title,
    content: `# ${title}`,
    order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('DiagramPanel', () => {
  it('renderiza um no para cada item recebido', () => {
    const items = [
      buildItem('a', 'Card Alfa'),
      buildItem('b', 'Card Beta'),
      buildItem('c', 'Card Gama'),
    ];

    render(
      <DiagramPanel
        items={items}
        theme="dark"
        activeItemId={null}
        onSelectItem={() => {}}
        onChangeStatus={() => {}}
      />,
    );

    expect(screen.getByText('Card Alfa')).toBeInTheDocument();
    expect(screen.getByText('Card Beta')).toBeInTheDocument();
    expect(screen.getByText('Card Gama')).toBeInTheDocument();
    expect(screen.getAllByTestId('port')).toHaveLength(24);
  });

  it('mostra mensagem vazia quando nao ha cards', () => {
    render(
      <DiagramPanel
        items={[]}
        theme="dark"
        activeItemId={null}
        onSelectItem={() => {}}
        onChangeStatus={() => {}}
      />,
    );

    expect(
      screen.getByText(/adicione cards para visualizar o diagrama/i),
    ).toBeInTheDocument();
  });

  it('oculta cards marcados como invisiveis', () => {
    const items = [buildItem('a', 'Card Oculto')];

    render(
      <DiagramPanel
        items={items}
        theme="dark"
        activeItemId={null}
        hiddenItemIds={new Set(['a'])}
        onSelectItem={() => {}}
        onChangeStatus={() => {}}
      />,
    );

    expect(screen.queryByText('Card Oculto')).not.toBeInTheDocument();
    expect(
      screen.getByText(/nenhum card visivel no diagrama/i),
    ).toBeInTheDocument();
  });
});


describe('conexões entre cards', () => {
  const items = [buildItem('a', 'Origem'), buildItem('b', 'Obstáculo'), buildItem('c', 'Destino')];
  const positions = { a: { x: 0, y: 0 }, b: { x: 0, y: 250 }, c: { x: 0, y: 500 } };
  const initialState = { positions, edges: [{ id: 'edge', from: 'a', fromPort: 'bottom' as const, to: 'c', toPort: 'top' as const }] };
  const obstacles = Object.values(positions).map((position) => ({ ...position, width: DIAGRAM_NODE_WIDTH, height: DIAGRAM_NODE_HEIGHT }));

  it('desvia a seta quadrada do card intermediário e mantém os pontos de conexão', () => {
    render(<DiagramPanel items={items} theme="light" activeItemId={null} initialState={initialState}
      edgeStyle="square" onSelectItem={() => {}} onChangeStatus={() => {}} />);
    const coordinates: number[] = JSON.parse(screen.getByTestId('arrow').getAttribute('data-points')!);
    const route = Array.from({ length: coordinates.length / 2 }, (_, i) => ({ x: coordinates[i * 2], y: coordinates[i * 2 + 1] }));
    expect(route[0]).toEqual({ x: 110, y: 130 });
    expect(route.at(-1)).toEqual({ x: 110, y: 500 });
    expect(isDatabasePathBlocked(route, obstacles)).toBe(false);
    expect(route.some((point) => point.x < 0 || point.x > 220)).toBe(true);
  });

  it('mantém o desvio curvo e permite remover a conexão ao clicar na linha', () => {
    const onChange = vi.fn();
    render(<DiagramPanel items={items} theme="dark" activeItemId={null} initialState={initialState}
      edgeStyle="curve" onDiagramStateChange={onChange} onSelectItem={() => {}} onChangeStatus={() => {}} />);
    const path = screen.getByTestId('path');
    expect(path.getAttribute('data-path')).toContain(' Q ');
    expect(screen.getByTestId('arrow')).toHaveAttribute('data-bezier', 'false');
    fireEvent.click(path);
    expect(screen.queryByTestId('path')).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ edges: [] }));
  });

  it('preserva a curva original quando o card intermediário está oculto', () => {
    render(<DiagramPanel items={items} theme="dark" activeItemId={null} initialState={initialState}
      hiddenItemIds={new Set(['b'])} edgeStyle="curve" onSelectItem={() => {}} onChangeStatus={() => {}} />);
    expect(screen.queryByTestId('path')).not.toBeInTheDocument();
    expect(screen.getByTestId('arrow')).toHaveAttribute('data-bezier', 'true');
  });
});


it('separa cards com posições salvas sobrepostas ao renderizar', () => {
  render(<DiagramPanel items={[buildItem('a', 'Primeiro'), buildItem('b', 'Segundo')]}
    theme="light" activeItemId={null} initialState={{ positions: { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } }, edges: [] }}
    onSelectItem={() => {}} onChangeStatus={() => {}} />);
  const nodes = screen.getAllByTestId('node');
  expect(nodes[0]).toHaveAttribute('data-y', '0');
  expect(nodes[1]).toHaveAttribute('data-y', '-178');
});
