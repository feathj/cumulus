import { describe, expect, it } from 'vitest';

import { CELL_FADE_S, cellCapacity, cellOpacity, cellWall, createCellSwarm, nucleusReach } from './cells';
import type { CellSwarm } from './cells';
import type { CloudCell } from './types';

/** mulberry32: a small seeded generator, so each run wanders the same way. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cards cycling through now, next and someday sizes. */
const pool = (size: number): CloudCell[] =>
  Array.from({ length: size }, (_, i) => ({ id: `card-${i}`, label: `Card ${i}`, scale: [1.6, 1, 0.6][i % 3] ?? 1 }));

const ids = (swarm: CellSwarm) => swarm.cells.map((cell) => cell.card.id);

/** Steps at 60fps for `seconds`, calling `each` after every frame. */
function run(swarm: CellSwarm, seconds: number, each: () => void = () => {}) {
  for (let frame = 0; frame < seconds * 60; frame++) {
    swarm.step(1 / 60);
    each();
  }
}

describe('cellCapacity', () => {
  it('shows one or two cells in small orbs and more in big ones, never more than there are cards', () => {
    expect(cellCapacity(10, 50)).toBe(1);
    expect(cellCapacity(36, 50)).toBe(1);
    expect(cellCapacity(52, 50)).toBe(3);
    expect(cellCapacity(78, 50)).toBe(5);
    expect(cellCapacity(200, 50)).toBe(6);
    expect(cellCapacity(78, 2)).toBe(2);
    expect(cellCapacity(78, 0)).toBe(0);
  });
});

describe('cellOpacity', () => {
  it('fades in, holds, and fades out', () => {
    expect(cellOpacity({ age: 0, life: 10 })).toBe(0);
    expect(cellOpacity({ age: CELL_FADE_S / 2, life: 10 })).toBeCloseTo(0.5);
    expect(cellOpacity({ age: 5, life: 10 })).toBe(1);
    expect(cellOpacity({ age: 10, life: 10 })).toBe(0);
  });
});

describe('cellWall', () => {
  it('keeps bigger cells further from the membrane', () => {
    const [now, next, someday] = pool(3);
    if (!now || !next || !someday) throw new Error('pool too small');

    expect(cellWall(now)).toBeLessThan(cellWall(next));
    expect(cellWall(next)).toBeLessThan(cellWall(someday));
  });
});

describe('createCellSwarm', () => {
  it('starts with as many different cards as it has room for', () => {
    const swarm = createCellSwarm(pool(10), 4, seeded(1));

    expect(new Set(ids(swarm)).size).toBe(4);
  });

  it('keeps every cell inside its wall, and never shows a card twice at once', () => {
    const swarm = createCellSwarm(pool(8), 5, seeded(2));

    run(swarm, 120, () => {
      for (const cell of swarm.cells) {
        expect(Math.hypot(cell.x, cell.y)).toBeLessThanOrEqual(cellWall(cell.card) + 1e-9);
      }
      expect(new Set(ids(swarm)).size).toBe(5);
    });
  });

  it('keeps cells clear of the label once it knows where the label is', () => {
    const nucleus = { halfWidth: 0.34, halfHeight: 0.16 };
    const swarm = createCellSwarm(pool(9), 5, seeded(3));
    swarm.setNucleus(nucleus);

    run(swarm, 120, () => {
      for (const cell of swarm.cells) {
        expect(nucleusReach(cell.x, cell.y, nucleus)).toBeGreaterThanOrEqual(1 - 1e-9);
        expect(Math.hypot(cell.x, cell.y)).toBeLessThanOrEqual(cellWall(cell.card) + 1e-9);
      }
    });
  });

  it('rotates every card in the pool into view over time', () => {
    const swarm = createCellSwarm(pool(12), 3, seeded(4));
    const seen = new Set(ids(swarm));

    run(swarm, 240, () => {
      for (const id of ids(swarm)) seen.add(id);
    });

    expect(seen.size).toBe(12);
  });

  it('keeps the same cards when there are no others to rotate in', () => {
    const swarm = createCellSwarm(pool(2), 2, seeded(5));

    run(swarm, 60, () => {
      expect([...ids(swarm)].sort()).toEqual(['card-0', 'card-1']);
    });
  });

  it('shows nothing for an empty pool', () => {
    const swarm = createCellSwarm([], 3, seeded(6));
    run(swarm, 1);

    expect(swarm.cells).toEqual([]);
  });
});
