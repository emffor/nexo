import { render, screen } from '@testing-library/react';
import { forwardRef, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
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
    Group: passthrough,
    Rect: () => <div data-testid="rect" />,
    Circle: () => <div data-testid="port" />,
    Arrow: () => <div data-testid="arrow" />,
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
    expect(screen.getAllByTestId('port')).toHaveLength(12);
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
});
