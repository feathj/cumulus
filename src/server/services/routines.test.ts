import { describe, expect, it } from 'vitest';

import { NotFoundError } from '@/server/errors';
import { testDb } from '@/test/db';

import {
  archiveRoutine,
  createRoutine,
  listRoutines,
  moveRoutine,
  renameRoutine,
  restoreRoutine,
  setRoutineChecked,
} from './routines';

const DAY = '2026-09-15';

async function titles(day = DAY) {
  return (await listRoutines(testDb, day)).map((routine) => routine.title);
}

describe('routines', () => {
  it('lists live routines in order, each marked for the day asked about', async () => {
    const exercise = await createRoutine(testDb, { title: '  Exercise ' });
    const meditate = await createRoutine(testDb, { title: 'Meditate' });
    await setRoutineChecked(testDb, { id: exercise.id, day: DAY, checked: true });

    expect(await listRoutines(testDb, DAY)).toEqual([
      { id: exercise.id, title: 'Exercise', checked: true },
      { id: meditate.id, title: 'Meditate', checked: false },
    ]);
    expect((await listRoutines(testDb, '2026-09-16')).map((routine) => routine.checked)).toEqual([false, false]);
  });

  it('checks and un-checks a day, either twice changing nothing', async () => {
    const read = await createRoutine(testDb, { title: 'Read' });

    await setRoutineChecked(testDb, { id: read.id, day: DAY, checked: true });
    await setRoutineChecked(testDb, { id: read.id, day: DAY, checked: true });
    expect(await testDb.routineCheck.count()).toBe(1);

    await setRoutineChecked(testDb, { id: read.id, day: DAY, checked: false });
    await setRoutineChecked(testDb, { id: read.id, day: DAY, checked: false });
    expect(await testDb.routineCheck.count()).toBe(0);
  });

  it('moves a routine to a slot, clamped to the end', async () => {
    await createRoutine(testDb, { title: 'A' });
    await createRoutine(testDb, { title: 'B' });
    const c = await createRoutine(testDb, { title: 'C' });

    await moveRoutine(testDb, { id: c.id, index: 0 });
    expect(await titles()).toEqual(['C', 'A', 'B']);

    await moveRoutine(testDb, { id: c.id, index: 99 });
    expect(await titles()).toEqual(['A', 'B', 'C']);
  });

  it('retires a routine keeping its days, and brings it back in its place', async () => {
    const a = await createRoutine(testDb, { title: 'A' });
    await createRoutine(testDb, { title: 'B' });
    await setRoutineChecked(testDb, { id: a.id, day: DAY, checked: true });

    await archiveRoutine(testDb, a.id);
    expect(await titles()).toEqual(['B']);
    expect(await testDb.routineCheck.count()).toBe(1);

    await restoreRoutine(testDb, a.id);
    expect(await listRoutines(testDb, DAY)).toMatchObject([
      { title: 'A', checked: true },
      { title: 'B', checked: false },
    ]);
  });

  it('renames, and refuses a blank name', async () => {
    const walk = await createRoutine(testDb, { title: 'Wlak' });

    await renameRoutine(testDb, { id: walk.id, title: 'Walk' });
    expect(await titles()).toEqual(['Walk']);

    await expect(renameRoutine(testDb, { id: walk.id, title: '   ' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(createRoutine(testDb, { title: '' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('throws NotFoundError for an unknown routine', async () => {
    await expect(setRoutineChecked(testDb, { id: 'missing', day: DAY, checked: true })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
