import { describe, expect, it } from 'vitest';

import { dayKey, formatDay, plural } from './format';

describe('formatDay', () => {
  const now = new Date(2026, 8, 14);

  it('leaves the year off dates in the current year', () => {
    expect(formatDay(new Date(2026, 8, 4), now)).toBe('Sep 4');
  });

  it('includes the year otherwise', () => {
    expect(formatDay(new Date(2025, 8, 4), now)).toBe('Sep 4, 2025');
  });
});

describe('dayKey', () => {
  it('matches times on the same day and separates different days', () => {
    expect(dayKey(new Date(2026, 8, 4, 9))).toBe(dayKey(new Date(2026, 8, 4, 18)));
    expect(dayKey(new Date(2026, 8, 4))).not.toBe(dayKey(new Date(2026, 8, 5)));
  });
});

describe('plural', () => {
  it('uses the singular only for exactly one', () => {
    expect(plural(1, 'card')).toBe('1 card');
    expect(plural(0, 'card')).toBe('0 cards');
    expect(plural(2, 'memory', 'memories')).toBe('2 memories');
  });
});
