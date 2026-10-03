import { describe, expect, it } from 'vitest';
import { buildRoutedDatabasePath, isDatabaseCurveBlocked, isDatabasePathBlocked, resolveDatabaseTablePosition, routeDatabaseConnection } from './databaseRouting';

describe('roteamento das conexões do banco', () => {
  const source = { x: 0, y: 0, width: 240, height: 160 };
  const target = { x: 800, y: 0, width: 240, height: 160 };
  const from = { x: 240, y: 50 }, to = { x: 800, y: 50 };

  it('contorna uma terceira tabela entre as duas conexões', () => {
    const obstacles = [source, target, { x: 400, y: -40, width: 240, height: 240 }];
    expect(isDatabasePathBlocked([from, to], obstacles)).toBe(true);
    const route = routeDatabaseConnection(from, 'right', to, 'left', obstacles)!;
    expect(route).not.toBeNull();
    expect(route[0]).toEqual(from);
    expect(route.at(-1)).toEqual(to);
    expect(isDatabasePathBlocked(route, obstacles)).toBe(false);
    expect(route.some((p) => p.y < -40 || p.y > 200)).toBe(true);
    expect(buildRoutedDatabasePath(route, false)).toContain(' L ');
    expect(buildRoutedDatabasePath(route, true)).toContain(' Q ');
  });

  it('detecta curva que sai pela lateral mas retorna por dentro da tabela', () => {
    const obstacles = [{ ...source, y: 260 }, { x: 180, y: 0, width: 240, height: 160 }];
    const origin = { x: 240, y: 310 };
    const curve = [origin, { x: 320, y: 310 }, { x: 500, y: 50 }, { x: 420, y: 50 }];
    expect(isDatabaseCurveBlocked(curve, obstacles)).toBe(true);
    const route = routeDatabaseConnection(origin, 'right', curve[3], 'right', obstacles)!;
    expect(route).not.toBeNull();
    expect(isDatabasePathBlocked(route, obstacles)).toBe(false);
  });

  it('recalcula o desvio quando uma tabela é movida sobre a conexão', () => {
    const free = [source, target, { x: 400, y: 300, width: 240, height: 160 }];
    const blocked = [source, target, { x: 400, y: 0, width: 240, height: 160 }];
    expect(isDatabasePathBlocked([from, to], free)).toBe(false);
    const route = routeDatabaseConnection(from, 'right', to, 'left', blocked)!;
    expect(isDatabasePathBlocked(route, blocked)).toBe(false);
  });

  it('preserva uma curva livre e não confunde o contato na borda com atravessar a tabela', () => {
    expect(isDatabaseCurveBlocked([from, { x: 350, y: 50 }, { x: 700, y: 50 }, to], [source, target])).toBe(false);
    expect(isDatabasePathBlocked([from, to], [source, target])).toBe(false);
    expect(isDatabasePathBlocked([{ x: 240, y: 50 }, { x: 100, y: 50 }], [source])).toBe(true);
  });

  it('não devolve um traçado que atravesse uma tabela sobre o ponto de conexão', () => {
    expect(routeDatabaseConnection(from, 'right', to, 'left', [source, target, { x: 230, y: 0, width: 240, height: 160 }])).toBeNull();
  });

  it('limita o arraste ao ponto livre mais próximo, preservando espaço para conexões', () => {
    const position = resolveDatabaseTablePosition({ x: 200, y: 30 }, 240, 160, [source]);
    expect(position).toEqual({ x: 288, y: 30 });
    expect(resolveDatabaseTablePosition({ x: 500, y: 30 }, 240, 160, [source])).toEqual({ x: 500, y: 30 });
    const route = routeDatabaseConnection(from, 'right', { x: position.x, y: 80 }, 'left', [source, { ...position, width: 240, height: 160 }]);
    expect(route).not.toBeNull();
  });
});


describe('roteamento nos quatro lados dos cards', () => {
  const obstacles = [
    { x: 0, y: 0, width: 220, height: 130 },
    { x: 0, y: 250, width: 220, height: 130 },
    { x: 0, y: 500, width: 220, height: 130 },
  ];

  it.each(['top', 'right', 'bottom', 'left'] as const)('preserva a saída pela porta %s sem atravessar cards', (side) => {
    const from = side === 'top' ? { x: 110, y: 0 } : side === 'bottom' ? { x: 110, y: 130 }
      : side === 'left' ? { x: 0, y: 65 } : { x: 220, y: 65 };
    const to = { x: 110, y: 500 };
    const route = routeDatabaseConnection(from, side, to, 'top', obstacles)!;
    expect(route).not.toBeNull();
    expect(route[0]).toEqual(from);
    expect(route.at(-1)).toEqual(to);
    expect(isDatabasePathBlocked(route, obstacles)).toBe(false);
    expect(isDatabasePathBlocked([...route].reverse(), obstacles)).toBe(false);
  });

  it('separa cards salvos sobrepostos sem bloquear suas portas', () => {
    const position = resolveDatabaseTablePosition({ x: 0, y: 0 }, 220, 130, [obstacles[0]]);
    expect(position).toEqual({ x: 0, y: -178 });
    const separated = [obstacles[0], { ...position, width: 220, height: 130 }];
    expect(routeDatabaseConnection({ x: 110, y: 0 }, 'top', { x: 110, y: -48 }, 'bottom', separated)).not.toBeNull();
  });
});
