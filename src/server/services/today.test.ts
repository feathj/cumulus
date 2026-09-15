import { describe, expect, it } from 'vitest';

import { testDb } from '@/test/db';
import { createCluster, createDomain, createNode } from '@/test/factories';

import { addToFocus } from './focus';
import { saveJournal } from './journal';
import { createRoutine } from './routines';
import { getDay } from './today';

describe('getDay', () => {
  it('brings routines, the journal and, only for today, the focus blocks together', async () => {
    const now = new Date('2026-09-15T18:00:00Z');
    const routine = await createRoutine(testDb, { title: 'Exercise' });
    await saveJournal(testDb, { day: '2026-09-15', body: 'Hello' });
    const cluster = await createCluster((await createDomain()).id);
    const node = await createNode(cluster.id);
    await addToFocus(testDb, node.id);

    const today = await getDay(testDb, { day: '2026-09-15', timeZone: 'UTC' }, now);
    expect(today).toMatchObject({
      day: '2026-09-15',
      today: '2026-09-15',
      routines: [{ id: routine.id, checked: false }],
      journal: { body: 'Hello' },
    });
    expect(today.focus?.map((card) => card.nodeId)).toEqual([node.id]);

    const yesterday = await getDay(testDb, { day: '2026-09-14', timeZone: 'UTC' }, now);
    expect(yesterday).toMatchObject({ day: '2026-09-14', today: '2026-09-15', focus: null, journal: { body: '' } });
  });

  it('reads today in the time zone asked about', async () => {
    const now = new Date('2026-09-15T03:00:00Z');

    expect((await getDay(testDb, { day: '2026-09-14', timeZone: 'America/Denver' }, now)).today).toBe('2026-09-14');
    expect((await getDay(testDb, { day: '2026-09-14', timeZone: 'Not/A_Zone' }, now)).day).toBe('2026-09-14');
  });
});
