import type { Priority } from '@prisma/client';

/** Board tiers, most urgent first. */
export const PRIORITIES: readonly Priority[] = ['NOW', 'NEXT', 'SOMEDAY'];

export type Tiers<Card> = Record<Priority, Card[]>;

export interface CardSlot {
  priority: Priority;
  index: number;
}

export function findCard<Card extends { id: string }>(tiers: Tiers<Card>, id: string): CardSlot | null {
  for (const priority of PRIORITIES) {
    const index = tiers[priority].findIndex((card) => card.id === id);
    if (index >= 0) return { priority, index };
  }
  return null;
}

/**
 * Moves a card to a slot in a tier the way the server's `moveNode` does: out
 * of wherever it was, into `index` of `priority` (clamped to the end), with its
 * own `priority` updated. Returns new tiers and leaves the input untouched; an
 * unknown id returns the tiers as they were.
 */
export function moveCard<Card extends { id: string; priority: Priority }>(
  tiers: Tiers<Card>,
  id: string,
  priority: Priority,
  index: number,
): Tiers<Card> {
  const from = findCard(tiers, id);
  const card = from ? tiers[from.priority][from.index] : undefined;
  if (!from || !card) return tiers;

  const next: Tiers<Card> = { NOW: [...tiers.NOW], NEXT: [...tiers.NEXT], SOMEDAY: [...tiers.SOMEDAY] };
  next[from.priority].splice(from.index, 1);
  const target = next[priority];
  target.splice(Math.min(Math.max(0, index), target.length), 0, { ...card, priority });
  return next;
}
