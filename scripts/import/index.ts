/**
 * Real-data import, for trying the app against my actual boards and notes.
 *
 *   npm run db:import                          # reads data/import.config.json
 *   npm run db:import -- path/to/config.json
 *
 * Like the seed, this wipes every domain and all memory first, and refuses to
 * run against production.
 */
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';

import { expandHome, loadConfig } from './config';
import { importLlmWiki } from './llm-wiki';
import { importTrello } from './trello';

const DEFAULT_CONFIG = 'data/import.config.json';

const db = new PrismaClient();

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to import: NODE_ENV is production.');
  }

  const configPath = expandHome(process.argv[2] ?? DEFAULT_CONFIG);
  const config = loadConfig(configPath);

  // Global memory has no domain to cascade from, so clear memory first.
  await db.memoryEntry.deleteMany();
  await db.memoryEvent.deleteMany();
  await db.domain.deleteMany();

  const domainIds = new Map<string, string>();
  for (const [position, domain] of config.domains.entries()) {
    const row = await db.domain.create({ data: { ...domain, position } });
    domainIds.set(domain.slug, row.id);
  }

  if (config.trello) {
    console.log(`Trello board: ${config.trello.file}`);
    const { checklistsWithoutItems, ...counts } = await importTrello(
      db,
      { ...config.trello, file: expandHome(config.trello.file) },
      domainIds,
    );
    console.log('  imported', counts);
    if (checklistsWithoutItems.length) {
      console.warn(
        `  ! checklist items are not in the export, so these cards lost theirs: ${checklistsWithoutItems.join('; ')}`,
      );
    }
  }

  if (config.llmWiki) {
    console.log(`LLM wiki: ${config.llmWiki.project}`);
    const { unresolvedLinks, ...counts } = await importLlmWiki(db, config.llmWiki, domainIds);
    console.log('  imported', counts);
    if (unresolvedLinks.length) {
      console.warn(`  ! [[links]] with no page or source: ${unresolvedLinks.join('; ')}`);
    }
  }

  const domains = await db.domain.findMany({
    orderBy: { position: 'asc' },
    include: { _count: { select: { clusters: true, focusItems: true, inboxItems: true } } },
  });
  const rows = [];
  for (const domain of domains) {
    const inDomain = { cluster: { domainId: domain.id } };
    // Memory stores only its narrowest owner, so "in this domain" is an OR.
    const memoryInDomain = {
      OR: [{ domainId: domain.id }, inDomain, { node: inDomain }],
    };
    rows.push({
      domain: domain.title,
      clusters: domain._count.clusters,
      nodes: await db.node.count({ where: inDomain }),
      done: await db.node.count({ where: { ...inDomain, completedAt: { not: null } } }),
      focus: domain._count.focusItems,
      inbox: domain._count.inboxItems,
      entries: await db.memoryEntry.count({ where: memoryInDomain }),
      events: await db.memoryEvent.count({ where: memoryInDomain }),
    });
  }
  console.table(rows);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
