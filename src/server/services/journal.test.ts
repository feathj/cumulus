import { describe, expect, it } from 'vitest';

import { testDb } from '@/test/db';
import { createCluster, createDomain, createNode } from '@/test/factories';

import { getJournal, saveJournal } from './journal';
import { getClusterMemory } from './memory';

const DAY = '2026-09-15';

describe('journal', () => {
  it('is empty for a day with nothing written', async () => {
    expect(await getJournal(testDb, DAY)).toEqual({ day: DAY, body: '', updatedAt: null });
  });

  it('keeps one entry per day, rewritten in place', async () => {
    await saveJournal(testDb, { day: DAY, body: 'first' });
    const saved = await saveJournal(testDb, { day: DAY, body: 'second\n' });

    expect(saved).toMatchObject({ day: DAY, body: 'second\n' });
    expect(saved.updatedAt).toBeInstanceOf(Date);
    expect(await testDb.journalEntry.count()).toBe(1);
    expect(await getJournal(testDb, DAY)).toMatchObject({ body: 'second\n' });
  });

  it('links the cards, or else the clusters, its [[wiki links]] name', async () => {
    const domain = await createDomain();
    const house = await createCluster(domain.id, { title: 'House' });
    const treads = await createNode(house.id, { title: 'Stair treads' });
    await createNode(house.id, { title: 'Old idea', archivedAt: new Date() });

    await saveJournal(testDb, {
      day: DAY,
      body: 'Sanded the [[Stair treads]]. More [[House]] work, not the [[Old idea]] or [[Nothing]].',
    });

    const entry = await testDb.journalEntry.findFirstOrThrow({ include: { nodeLinks: true, clusterLinks: true } });
    expect(entry.nodeLinks.map((link) => link.nodeId)).toEqual([treads.id]);
    expect(entry.clusterLinks.map((link) => link.clusterId)).toEqual([house.id]);

    await saveJournal(testDb, { day: DAY, body: 'Changed my mind.' });
    expect(await testDb.journalNodeLink.count()).toBe(0);
    expect(await testDb.journalClusterLink.count()).toBe(0);
  });

  it('removes the day when its text is cleared', async () => {
    await saveJournal(testDb, { day: DAY, body: 'something' });

    expect(await saveJournal(testDb, { day: DAY, body: '  \n' })).toEqual({ day: DAY, body: '', updatedAt: null });
    expect(await testDb.journalEntry.count()).toBe(0);
  });

  it("puts days that mention a cluster or its cards on that cluster's memory timeline", async () => {
    const domain = await createDomain({ slug: 'personal' });
    const house = await createCluster(domain.id, { slug: 'house', title: 'House' });
    await createCluster(domain.id, { slug: 'garden', title: 'Garden' });
    const treads = await createNode(house.id, { title: 'Stair treads' });
    await saveJournal(testDb, { day: '2026-09-14', body: 'About the [[House]].' });
    await saveJournal(testDb, { day: '2026-09-15', body: 'Worked on [[Stair treads]].' });
    await saveJournal(testDb, { day: '2026-09-13', body: 'Only the [[Garden]].' });

    const memory = await getClusterMemory(testDb, 'personal', 'house');

    expect(memory.journal).toEqual([
      { day: '2026-09-15', body: 'Worked on [[Stair treads]].', nodes: [{ id: treads.id, title: 'Stair treads' }] },
      { day: '2026-09-14', body: 'About the [[House]].', nodes: [] },
    ]);
  });
});
