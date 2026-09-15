import { dayIn, resolveTimeZone } from '@/lib/day';
import type { DayKey } from '@/lib/day';

import { listCompletedOn, listFocus } from './focus';
import type { DoneCard, FocusCard } from './focus';
import { getJournal } from './journal';
import type { JournalDay } from './journal';
import { listRoutines } from './routines';
import type { RoutineView } from './routines';
import type { Db } from './types';

export interface TodayView {
  day: DayKey;
  /** The current day in the time zone asked about. */
  today: DayKey;
  routines: RoutineView[];
  /**
   * The open cards in every domain's focus block, only when `day` is today.
   * The queue holds no history: what's in it is what's waiting now.
   */
  focus: FocusCard[] | null;
  /** What was checked off on `day`, in the order it was done. */
  done: DoneCard[];
  journal: JournalDay;
}

/**
 * One day, as the Today page shows it: routines, what's in focus, what got
 * done and the journal. The time zone decides which day is today and which
 * day a card was checked off on; one the server doesn't know falls back to
 * the server's own.
 */
export async function getDay(
  db: Db,
  { day, timeZone }: { day: DayKey; timeZone: string },
  now: Date = new Date(),
): Promise<TodayView> {
  const zone = resolveTimeZone(timeZone);
  const today = dayIn(now, zone);
  const [routines, focus, done, journal] = await Promise.all([
    listRoutines(db, day),
    day === today ? listFocus(db) : null,
    listCompletedOn(db, { day, timeZone: zone }),
    getJournal(db, day),
  ]);
  return { day, today, routines, focus, done, journal };
}
