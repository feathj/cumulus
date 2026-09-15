import { describe, expect, it } from 'vitest';

import { dayIn, formatLongDay, formatShortDay, isDayKey, localNoon, resolveTimeZone, shiftDay } from './day';

describe('isDayKey', () => {
  it('accepts real calendar days written YYYY-MM-DD', () => {
    expect(isDayKey('2026-09-15')).toBe(true);
    expect(isDayKey('2028-02-29')).toBe(true);
  });

  it('rejects other shapes and days that do not exist', () => {
    for (const value of ['2026-9-15', '2026-02-30', '2026-13-01', 'today', '2026-09-15T00:00']) {
      expect(isDayKey(value)).toBe(false);
    }
  });
});

describe('dayIn', () => {
  it('reads the day in the given time zone', () => {
    const instant = new Date('2026-09-15T03:30:00Z');
    expect(dayIn(instant, 'UTC')).toBe('2026-09-15');
    expect(dayIn(instant, 'America/Denver')).toBe('2026-09-14');
    expect(dayIn(instant, 'Asia/Tokyo')).toBe('2026-09-15');
  });
});

describe('resolveTimeZone', () => {
  it('keeps a zone it knows and falls back to its own otherwise', () => {
    const own = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(resolveTimeZone('America/Denver')).toBe('America/Denver');
    expect(resolveTimeZone('Not/A_Zone')).toBe(own);
    expect(resolveTimeZone(undefined)).toBe(own);
  });
});

describe('shiftDay', () => {
  it('crosses month and year ends', () => {
    expect(shiftDay('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('day formatting', () => {
  it('names the day, with the year only outside the current one', () => {
    expect(formatLongDay('2026-09-15', '2026-09-20')).toBe('Tuesday, September 15');
    expect(formatLongDay('2025-12-31', '2026-01-02')).toBe('Wednesday, December 31, 2025');
    expect(formatShortDay('2026-09-12', '2026-09-15')).toBe('Sep 12');
    expect(formatShortDay('2025-12-30', '2026-01-02')).toBe('Dec 30, 2025');
  });

  it('gives local noon on the day', () => {
    const noon = localNoon('2026-09-15');
    expect([noon.getFullYear(), noon.getMonth(), noon.getDate(), noon.getHours()]).toEqual([2026, 8, 15, 12]);
  });
});
