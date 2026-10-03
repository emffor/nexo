import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { parseDbml } from '../../lib/dbml';
import { isDatabasePathBlocked } from '../../lib/databaseRouting';
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

  const Stage = forwardRef<HTMLDivElement, {
    children?: ReactNode;
    width?: number;
    height?: number;
    onWheel?: (event: { evt: WheelEvent }) => void;
  }>(
    function Stage({ children, width, height, onWheel }, ref) {
      if (typeof ref === 'function') {
        ref(stageRefValue as unknown as HTMLDivElement);
      } else if (ref) {
        ref.current = stageRefValue as unknown as HTMLDivElement;
      }
      return <div data-testid="database-stage" data-width={width} data-height={height} onWheel={(event) => onWheel?.({ evt: event.nativeEvent })}>{children}</div>;
    },
  );

  function Passthrough({
    children,
    onClick,
    onMouseEnter,
    onMouseLeave,
  }: {
    children?: ReactNode;
    onClick?: (event: ReturnType<typeof buildEvent>) => void;
    onMouseEnter?: (event: ReturnType<typeof buildEvent>) => void;
    onMouseLeave?: (event: ReturnType<typeof buildEvent>) => void;
  }) {
    return <div onClick={() => onClick?.(buildEvent())} onMouseEnter={() => onMouseEnter?.(buildEvent())} onMouseLeave={() => onMouseLeave?.(buildEvent())}>{children}</div>;
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

  const Path = forwardRef<
    HTMLSpanElement,
    {
      data?: string;
      onClick?: (event: ReturnType<typeof buildEvent>) => void;
      onDblClick?: (event: ReturnType<typeof buildEvent>) => void;
    }
  >(function Path({ data, onClick, onDblClick }, ref) {
    const pathRefValue = {
      dashOffset: vi.fn(),
      getLayer: () => null,
    };

    if (typeof ref === 'function') {
      ref(pathRefValue as unknown as HTMLSpanElement);
    } else if (ref) {
      ref.current = pathRefValue as unknown as HTMLSpanElement;
    }

    return onClick ? (
      <button
        type="button"
        aria-label="Selecionar relação"
        data-path={data}
        onClick={() => onClick(buildEvent())}
        onDoubleClick={() => onDblClick?.(buildEvent())}
      />
    ) : (
      <span data-testid="path" data-path={data} />
    );
  });

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
  it('desenha as relações por fora de uma terceira tabela que bloqueia o trajeto', () => {
    const parsed = parseDbml(content + '\nTable blocker {\n id integer [pk]\n name varchar\n}\n');
    const state = { positions: { users: { x: 40, y: 40 }, posts: { x: 800, y: 40 }, blocker: { x: 400, y: 40 } } };
    render(<DatabaseDiagramPanel tables={parsed.tables} relations={parsed.relations}
      theme="dark" state={state} onStateChange={vi.fn()} edgeStyle="square" />);

    const paths = screen.getAllByTestId('path');
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      const values = path.dataset.path!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      const points = Array.from({ length: values.length / 2 }, (_, index) => ({ x: values[index * 2], y: values[index * 2 + 1] }));
      expect(isDatabasePathBlocked(points, Object.values(state.positions).map((p) => ({ ...p, width: 240, height: 92 })))).toBe(false);
    }
  });

  it('mantém o zoom salvo ao entrar, mover e sair com o mouse sobre uma tabela', () => {
    const onStateChange = vi.fn();
    renderPanel({
      onStateChange,
      state: {
        positions: { users: { x: 40, y: 40 }, posts: { x: 360, y: 40 } },
        viewport: { x: 20, y: 30, scale: 1.23 },
      },
    });
    const table = screen.getByText('users').parentElement!;

    fireEvent.mouseEnter(table);
    fireEvent.mouseMove(table);
    fireEvent.mouseLeave(table);

    expect(screen.getByText('123%')).toBeInTheDocument();
    expect(onStateChange).not.toHaveBeenCalled();
  });

  it('não altera o zoom com rolagem comum ou horizontal; aceita Ctrl + rolagem vertical', () => {
    const onStateChange = vi.fn();
    renderPanel({ onStateChange });
    const stage = screen.getByTestId('database-stage');

    fireEvent.wheel(stage, { deltaY: -100 });
    fireEvent.wheel(stage, { deltaX: 100, deltaY: 0, ctrlKey: true });
    expect(onStateChange).not.toHaveBeenCalled();

    fireEvent.wheel(stage, { deltaY: -100, ctrlKey: true });
    expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({
      viewport: expect.objectContaining({ scale: expect.any(Number) }),
    }));
  });

  it('mede a área interna do container sem incluir sua borda', () => {
    const width = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(798);
    const height = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(598);
    try {
      renderPanel();
      const stage = screen.getByTestId('database-stage');
      expect(stage).toHaveAttribute('data-width', '798');
      expect(stage).toHaveAttribute('data-height', '598');
    } finally {
      width.mockRestore();
      height.mockRestore();
    }
  });
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

  it('aplica auto-organizacao left-right pelo popover', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Organizar' }));
    expect(
      screen.getByRole('dialog', {
        name: 'Escolher algoritmo de auto-organização',
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Esquerda-direita/ }));

    const nextState = onStateChange.mock.calls[0]?.[0];
    expect(nextState.positions.posts.x).toBeLessThan(
      nextState.positions.users.x,
    );
    expect(nextState.relationPaths).toBeUndefined();
  });

  it('renderiza relacao do banco como curva quando preferencia de curva esta ativa', () => {
    renderPanel({ edgeStyle: 'curve' });

    expect(
      screen
        .getAllByTestId('path')
        .some((path) => path.dataset.path?.includes(' C ')),
    ).toBe(true);
  });

  it('mantem edicao ortogonal quando preferencia quadrada esta ativa', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    renderPanel({
      edgeStyle: 'square',
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
              { x: 360, y: 111 },
              { x: 320, y: 111 },
              { x: 320, y: 85 },
              { x: 280, y: 85 },
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
    const segmentHandle = dragHandles[2];
    const startX = Number(segmentHandle.dataset.x);

    fireEvent.mouseMove(segmentHandle);
    fireEvent.mouseUp(segmentHandle);

    expect(onStateChange).toHaveBeenCalledTimes(1);
    const nextState = onStateChange.mock.calls[0]?.[0];
    const nextPoints = nextState.relationPaths.user_posts.points;
    expect(nextPoints[1].x).toBe(startX + 24);
    expect(nextPoints[2].x).toBe(startX + 24);
  });
});
