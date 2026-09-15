import { dayIn, resolveTimeZone } from '@/lib/day';
import type { DayKey } from '@/lib/day';

import { listFocus } from './focus';
import type { FocusCard } from './focus';
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
  /** Every domain's focus block, only when `day` is today: the queue keeps no history of other days. */
  focus: FocusCard[] | null;
  journal: JournalDay;
}

/**
 * One day, as the Today page shows it: routines, the focus blocks and the
 * journal. The time zone decides which day is today and which day a card was
 * checked off on; one the server doesn't know falls back to the server's own.
 */
export async function getDay(
  db: Db,
  { day, timeZone }: { day: DayKey; timeZone: string },
  now: Date = new Date(),
): Promise<TodayView> {
  const zone = resolveTimeZone(timeZone);
  const today = dayIn(now, zone);
  const [routines, focus, journal] = await Promise.all([
    listRoutines(db, day),
    day === today ? listFocus(db, { day, timeZone: zone }) : null,
    getJournal(db, day),
  ]);
  return { day, today, routines, focus, journal };
}
