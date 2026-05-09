import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { parseDbml } from '../../lib/dbml';
import type { DatabaseDiagramVisualState } from '../../types/database';

vi.mock('react-konva', () => {
  const stageRefValue = {
    position: vi.fn(),
    scale: vi.fn(),
    batchDraw: vi.fn(),
    x: vi.fn(() => 0),
    y: vi.fn(() => 0),
    scaleX: vi.fn(() => 1),
    getPointerPosition: vi.fn(() => ({ x: 0, y: 0 })),
  };
  const stageTarget = {
    getStage: () => ({
      container: () => ({ style: {} }),
    }),
  };

  const buildEvent = () => ({
    cancelBubble: false,
    target: stageTarget,
  });

  const buildDragEvent = (x: number, y: number) => ({
    cancelBubble: false,
    target: {
      ...stageTarget,
      x: () => x,
      y: () => y,
    },
  });

  const Stage = forwardRef<HTMLDivElement, { children?: ReactNode }>(
    function Stage({ children }, ref) {
      if (typeof ref === 'function') {
        ref(stageRefValue as unknown as HTMLDivElement);
      } else if (ref) {
        ref.current = stageRefValue as unknown as HTMLDivElement;
      }
      return <div data-testid="database-stage">{children}</div>;
    },
  );

  function Passthrough({
    children,
    onClick,
  }: {
    children?: ReactNode;
    onClick?: (event: ReturnType<typeof buildEvent>) => void;
  }) {
    return <div onClick={() => onClick?.(buildEvent())}>{children}</div>;
  }

  function Text({
    text,
    onClick,
  }: {
    text?: string;
    onClick?: (event: ReturnType<typeof buildEvent>) => void;
  }) {
    return onClick ? (
      <button type="button" onClick={() => onClick(buildEvent())}>
        {text}
      </button>
    ) : (
      <span>{text}</span>
    );
  }

  function Line({
    onClick,
  }: {
    onClick?: (event: ReturnType<typeof buildEvent>) => void;
  }) {
    return onClick ? (
      <button type="button" aria-label="Selecionar relação" onClick={() => onClick(buildEvent())} />
    ) : (
      <span data-testid="line" />
    );
  }

  function Path({
    onClick,
    onDblClick,
  }: {
    onClick?: (event: ReturnType<typeof buildEvent>) => void;
    onDblClick?: (event: ReturnType<typeof buildEvent>) => void;
  }) {
    return onClick ? (
      <button
        type="button"
        aria-label="Selecionar relação"
        onClick={() => onClick(buildEvent())}
        onDoubleClick={() => onDblClick?.(buildEvent())}
      />
    ) : (
      <span data-testid="path" />
    );
  }

  return {
    Stage,
    Circle: ({
      draggable,
      onDragStart,
      onDragMove,
      onDragEnd,
      x = 0,
      y = 0,
    }: {
      draggable?: boolean;
      onDragStart?: (event: ReturnType<typeof buildDragEvent>) => void;
      onDragMove?: (event: ReturnType<typeof buildDragEvent>) => void;
      onDragEnd?: (event: ReturnType<typeof buildDragEvent>) => void;
      x?: number;
      y?: number;
    }) =>
      draggable ? (
        <button
          type="button"
          aria-label="Arrastar ponto da relacao"
          data-x={x}
          data-y={y}
          onMouseDown={() => onDragStart?.(buildDragEvent(x, y))}
          onMouseMove={() => onDragMove?.(buildDragEvent(x + 12, y + 12))}
          onMouseUp={() => onDragEnd?.(buildDragEvent(x + 12, y + 12))}
        />
      ) : (
        <span data-testid="circle" />
      ),
    Layer: Passthrough,
    Group: Passthrough,
    Rect: () => <span data-testid="rect" />,
    Line,
    Path,
    Text,
  };
});

import DatabaseDiagramPanel from './DatabaseDiagramPanel';

const content = `
Table users {
  id integer [pk]
  username varchar
}

Table posts {
  id integer [pk]
  user_id integer [not null]
}

Ref user_posts: posts.user_id > users.id

Records users(id, username) {
  1, 'Ada'
}
`;

function renderPanel(overrides?: {
  onRenameTable?: (tableName: string, nextName: string) => boolean;
  onRenameColumn?: (
    tableName: string,
    columnName: string,
    nextName: string,
  ) => boolean;
  onStateChange?: (state: DatabaseDiagramVisualState) => void;
  state?: DatabaseDiagramVisualState;
  edgeStyle?: 'square' | 'curve';
}) {
  const parsed = parseDbml(content);
  const state: DatabaseDiagramVisualState = overrides?.state ?? {
    positions: {
      users: { x: 40, y: 40 },
      posts: { x: 360, y: 40 },
    },
  };

  render(
    <DatabaseDiagramPanel
      tables={parsed.tables}
      relations={parsed.relations}
      theme="light"
      state={state}
      onStateChange={overrides?.onStateChange ?? (() => {})}
      onRenameTable={overrides?.onRenameTable}
      onRenameColumn={overrides?.onRenameColumn}
      edgeStyle={overrides?.edgeStyle}
    />,
  );
}

describe('DatabaseDiagramPanel', () => {
  it('abre popover e confirma renomeacao de tabela', async () => {
    const user = userEvent.setup();
    const onRenameTable = vi.fn(() => true);
    renderPanel({ onRenameTable });

    await user.click(screen.getByRole('button', { name: 'users' }));
    const input = screen.getByLabelText('Table Name');
    await user.clear(input);
    await user.type(input, 'accounts');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onRenameTable).toHaveBeenCalledWith('users', 'accounts');
  });

  it('abre popover e confirma renomeacao de coluna', async () => {
    const user = userEvent.setup();
    const onRenameColumn = vi.fn(() => true);
    renderPanel({ onRenameColumn });

    await user.click(screen.getByText('user_id'));
    const input = screen.getByLabelText('Column Name');
    await user.clear(input);
    await user.type(input, 'author_id');
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onRenameColumn).toHaveBeenCalledWith(
      'posts',
      'user_id',
      'author_id',
    );
  });

  it('abre modal de records somente leitura', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'users' }));
    await user.click(screen.getByRole('button', { name: 'Ver records' }));

    expect(
      screen.getByRole('dialog', { name: /records de users/i }),
    ).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
  });

  it('previsualiza drag de relacao sem persistir antes do fim', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    renderPanel({
      onStateChange,
      state: {
        positions: {
          users: { x: 40, y: 40 },
          posts: { x: 360, y: 40 },
        },
        relationPaths: {
          user_posts: {
            fromSide: 'left',
            toSide: 'right',
            points: [
              { x: 360, y: 71 },
              { x: 320, y: 71 },
              { x: 320, y: 45 },
              { x: 280, y: 45 },
            ],
          },
        },
      },
    });

    await user.dblClick(
      screen.getAllByRole('button', { name: 'Selecionar relação' })[0],
    );
    const dragHandle = screen.getAllByRole('button', {
      name: 'Arrastar ponto da relacao',
    })[0];

    fireEvent.mouseMove(dragHandle);
    expect(onStateChange).not.toHaveBeenCalled();

    fireEvent.mouseUp(dragHandle);
    expect(onStateChange).toHaveBeenCalledTimes(1);
  });

  it('move os pontos de controle da curva em conjunto', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    renderPanel({
      edgeStyle: 'curve',
      onStateChange,
      state: {
        positions: {
          users: { x: 40, y: 40 },
          posts: { x: 360, y: 40 },
        },
        relationPaths: {
          user_posts: {
            fromSide: 'left',
            toSide: 'right',
            points: [
              { x: 360, y: 71 },
              { x: 320, y: 71 },
              { x: 280, y: 45 },
              { x: 280, y: 45 },
            ],
          },
        },
      },
    });

    await user.dblClick(
      screen.getAllByRole('button', { name: 'Selecionar relação' })[0],
    );

    const dragHandles = screen.getAllByRole('button', {
      name: 'Arrastar ponto da relacao',
    }) as HTMLButtonElement[];
    const firstHandle = dragHandles[2];
    const secondHandle = dragHandles[3];
    const firstStart = {
      x: Number(firstHandle.dataset.x),
      y: Number(firstHandle.dataset.y),
    };
    const secondStart = {
      x: Number(secondHandle.dataset.x),
      y: Number(secondHandle.dataset.y),
    };

    fireEvent.mouseDown(firstHandle);
    fireEvent.mouseMove(firstHandle);
    fireEvent.mouseUp(firstHandle);

    expect(onStateChange).toHaveBeenCalledTimes(1);
    const nextState = onStateChange.mock.calls[0]?.[0];
    const nextControlPoints = nextState.relationPaths.user_posts.points.slice(
      1,
      3,
    );
    expect(nextControlPoints[0]).toEqual({
      x: firstStart.x + 24,
      y: firstStart.y + 24,
    });
    expect(nextControlPoints[1]).toEqual({
      x: secondStart.x + 24,
      y: secondStart.y + 24,
    });
  });
});
