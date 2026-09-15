import { dayToDate } from '@/lib/day';
import type { DayKey } from '@/lib/day';

import { DomainError, NotFoundError } from '../errors';
import { withTransaction } from './types';
import type { Db } from './types';

export interface RoutineView {
  id: string;
  title: string;
  /** Whether it was done on the day asked about. */
  checked: boolean;
}

function requireTitle(title: string): string {
  const name = title.trim().replace(/\s+/g, ' ');
  if (!name) throw new DomainError('BAD_REQUEST', 'A routine needs a name.');
  return name;
}

async function getRoutine(db: Db, id: string) {
  const routine = await db.routine.findUnique({
    where: { id },
    select: { id: true, position: true, archivedAt: true },
  });
  if (!routine) throw new NotFoundError('Routine', id);
  return routine;
}

const liveOrder = [{ position: 'asc' as const }, { createdAt: 'asc' as const }];

/** Live routines in order, each marked with whether it was done on `day`. */
export async function listRoutines(db: Db, day: DayKey): Promise<RoutineView[]> {
  const routines = await db.routine.findMany({
    where: { archivedAt: null },
    orderBy: liveOrder,
    select: { id: true, title: true, checks: { where: { day: dayToDate(day) }, select: { day: true } } },
  });
  return routines.map(({ checks, ...routine }) => ({ ...routine, checked: checks.length > 0 }));
}

/** A new routine at the end of the list. */
export async function createRoutine(db: Db, { title }: { title: string }): Promise<RoutineView> {
  const name = requireTitle(title);
  return withTransaction(db, async (tx) => {
    const last = await tx.routine.aggregate({ where: { archivedAt: null }, _max: { position: true } });
    const routine = await tx.routine.create({
      data: { title: name, position: (last._max.position ?? -1) + 1 },
      select: { id: true, title: true },
    });
    return { ...routine, checked: false };
  });
}

export async function renameRoutine(db: Db, { id, title }: { id: string; title: string }): Promise<void> {
  const name = requireTitle(title);
  await getRoutine(db, id);
  await db.routine.update({ where: { id }, data: { title: name } });
}

/** Moves a live routine to a slot among the others, which are renumbered 0..n-1 around it. */
export async function moveRoutine(db: Db, { id, index }: { id: string; index: number }): Promise<void> {
  await withTransaction(db, async (tx) => {
    const routine = await getRoutine(tx, id);
    if (routine.archivedAt) throw new DomainError('CONFLICT', 'Bring that routine back before moving it.');

    const others = await tx.routine.findMany({
      where: { archivedAt: null, id: { not: id } },
      orderBy: liveOrder,
      select: { id: true, position: true },
    });
    const slot = Math.min(Math.max(0, index), others.length);
    const order = [...others.slice(0, slot), routine, ...others.slice(slot)];
    for (const [position, { id: routineId, position: current }] of order.entries()) {
      if (current !== position) await tx.routine.update({ where: { id: routineId }, data: { position } });
    }
  });
}

/** Retires a routine: it leaves Today, and the days it was done are kept. Retiring twice changes nothing. */
export async function archiveRoutine(db: Db, id: string): Promise<void> {
  const routine = await getRoutine(db, id);
  if (routine.archivedAt) return;
  await db.routine.update({ where: { id }, data: { archivedAt: new Date() } });
}

/** Brings a retired routine back, in the place it had. */
export async function restoreRoutine(db: Db, id: string): Promise<void> {
  const routine = await getRoutine(db, id);
  if (!routine.archivedAt) return;
  await db.routine.update({ where: { id }, data: { archivedAt: null } });
}

/** Marks a routine done on a day, or not. Doing either twice changes nothing. */
export async function setRoutineChecked(
  db: Db,
  { id, day, checked }: { id: string; day: DayKey; checked: boolean },
): Promise<void> {
  await getRoutine(db, id);
  const date = dayToDate(day);
  if (checked) {
    await db.routineCheck.upsert({
      where: { routineId_day: { routineId: id, day: date } },
      create: { routineId: id, day: date },
      update: {},
    });
  } else {
    await db.routineCheck.deleteMany({ where: { routineId: id, day: date } });
  }
}
