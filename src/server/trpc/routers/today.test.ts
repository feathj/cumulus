import { describe, expect, it } from 'vitest';

import { testDb } from '@/test/db';

import { createCaller } from '../root';

const caller = createCaller({ db: testDb });

describe('today', () => {
  it('rejects a day that is not a real YYYY-MM-DD', async () => {
    await expect(caller.today.day({ day: '2026-02-30', timeZone: 'UTC' })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    await expect(caller.journal.save({ day: 'today', body: 'x' })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('checks a routine off and saves the journal for a day', async () => {
    const routine = await caller.routine.create({ title: 'Meditate' });
    await caller.routine.check({ id: routine.id, day: '2026-09-15', checked: true });
    await caller.journal.save({ day: '2026-09-15', body: 'Quiet morning.' });

    const view = await caller.today.day({ day: '2026-09-15', timeZone: 'UTC' });

    expect(view.routines).toEqual([{ id: routine.id, title: 'Meditate', checked: true }]);
    expect(view.journal.body).toBe('Quiet morning.');
  });
});
