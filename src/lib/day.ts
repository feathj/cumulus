/**
 * Calendar days as `YYYY-MM-DD` keys. A day belongs to whoever is living it,
 * so turning an instant into a day always takes a time zone; the browser's
 * reaches the server in a cookie.
 */

export type DayKey = string;

/** Holds the browser's IANA time zone, so the server reads "today" the way the browser does. */
export const TIME_ZONE_COOKIE = 'cumulus-tz';

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Midnight UTC on the day: how a `@db.Date` column holds it. */
export function dayToDate(day: DayKey): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

/** The day a `@db.Date` value holds. */
export function dateToDay(date: Date): DayKey {
  return date.toISOString().slice(0, 10);
}

/** Whether `value` is a real calendar day written `YYYY-MM-DD`. */
export function isDayKey(value: string): value is DayKey {
  if (!DAY_KEY.test(value)) return false;
  const date = dayToDate(value);
  // Out-of-range days either fail to parse or roll into the next month.
  return !Number.isNaN(date.getTime()) && dateToDay(date) === value;
}

/** `timeZone` if the runtime knows it, otherwise the runtime's own. */
export function resolveTimeZone(timeZone: string | null | undefined): string {
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;
    } catch {
      // Not a zone this runtime knows.
    }
  }
  return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** The calendar day an instant falls on in a time zone. */
export function dayIn(instant: Date, timeZone: string): DayKey {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/** The day `days` after `day`, or before it when negative. */
export function shiftDay(day: DayKey, days: number): DayKey {
  const date = dayToDate(day);
  date.setUTCDate(date.getUTCDate() + days);
  return dateToDay(date);
}

/** Noon on the day in the runtime's own time zone: an instant that groups under that local day. */
export function localNoon(day: DayKey): Date {
  const [year = 1970, month = 1, date = 1] = day.split('-').map(Number);
  return new Date(year, month - 1, date, 12);
}

// Days are formatted at midnight UTC in UTC, so no zone can shift them.
const longDay = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const longDayWithYear = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});
const shortDay = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const shortDayWithYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "Tuesday, September 15", with the year when it isn't `today`'s. */
export function formatLongDay(day: DayKey, today: DayKey): string {
  return (day.slice(0, 4) === today.slice(0, 4) ? longDay : longDayWithYear).format(dayToDate(day));
}

/** "Sep 12", with the year when it isn't `today`'s. */
export function formatShortDay(day: DayKey, today: DayKey): string {
  return (day.slice(0, 4) === today.slice(0, 4) ? shortDay : shortDayWithYear).format(dayToDate(day));
}
