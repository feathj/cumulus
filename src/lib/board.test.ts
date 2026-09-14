import type { Priority } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { findCard, moveCard } from './board';
import type { Tiers } from './board';

interface Card {
  id: string;
  priority: Priority;
}

function tiers(layout: Partial<Record<Priority, string[]>>): Tiers<Card> {
  const tier = (priority: Priority) => (layout[priority] ?? []).map((id) => ({ id, priority }));
  return { NOW: tier('NOW'), NEXT: tier('NEXT'), SOMEDAY: tier('SOMEDAY') };
}

const ids = (board: Tiers<Card>) => ({
  NOW: board.NOW.map((c) => c.id),
  NEXT: board.NEXT.map((c) => c.id),
  SOMEDAY: board.SOMEDAY.map((c) => c.id),
});

describe('findCard', () => {
  it('reports the tier and slot a card is in', () => {
    expect(findCard(tiers({ NOW: ['a'], NEXT: ['b', 'c'] }), 'c')).toEqual({ priority: 'NEXT', index: 1 });
    expect(findCard(tiers({ NOW: ['a'] }), 'zzz')).toBeNull();
  });
});

describe('moveCard', () => {
  it('reorders within a tier', () => {
    const moved = moveCard(tiers({ NOW: ['a', 'b', 'c'] }), 'a', 'NOW', 2);
    expect(ids(moved).NOW).toEqual(['b', 'c', 'a']);
  });

  it('moves between tiers and updates the card priority', () => {
    const moved = moveCard(tiers({ NOW: ['a', 'b'], NEXT: ['x'] }), 'b', 'NEXT', 0);
    expect(ids(moved)).toEqual({ NOW: ['a'], NEXT: ['b', 'x'], SOMEDAY: [] });
    expect(moved.NEXT[0]).toEqual({ id: 'b', priority: 'NEXT' });
  });

  it('clamps a slot past the end', () => {
    expect(ids(moveCard(tiers({ NOW: ['a'], SOMEDAY: ['z'] }), 'a', 'SOMEDAY', 10)).SOMEDAY).toEqual(['z', 'a']);
  });

  it('leaves the input untouched and ignores unknown cards', () => {
    const board = tiers({ NOW: ['a', 'b'] });
    moveCard(board, 'a', 'NEXT', 0);
    expect(ids(board)).toEqual({ NOW: ['a', 'b'], NEXT: [], SOMEDAY: [] });
    expect(moveCard(board, 'nope', 'NEXT', 0)).toBe(board);
  });
});
