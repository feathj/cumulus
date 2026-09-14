const dayInYear = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const dayWithYear = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const timeOfDay = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * "Sep 4", or "Sep 4, 2025" outside the current year. Deliberately absolute:
 * relative dates ("3d ago") would differ between the server render and
 * hydration.
 */
export function formatDay(date: Date, now: Date = new Date()): string {
  return date.getFullYear() === now.getFullYear()
    ? dayInYear.format(date)
    : dayWithYear.format(date);
}

/** "6:04 PM". */
export function formatTime(date: Date): string {
  return timeOfDay.format(date);
}

/** A key that is equal for two dates on the same local calendar day. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** "1 card", "3 cards". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
