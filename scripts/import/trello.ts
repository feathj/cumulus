/**
 * Trello board export -> clusters, nodes, focus queue and inbox.
 *
 * A board mixes two kinds of list. Topic lists ("Books", "Food ideas") map
 * straight onto a cluster. Status lists ("Upcoming", "in process", "Done")
 * describe where a card sits in my workflow, which Cumulus models as priority,
 * the focus block and `completedAt` — so each of their cards is routed to a
 * topic cluster by name instead.
 */
import { readFileSync } from 'node:fs';

import { NodeKind, Priority } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

import type { TrelloConfig } from './config';

interface TrelloAttachment {
  name: string;
  url: string;
  mimeType: string;
  bytes: number | null;
  date: string;
}

interface TrelloCard {
  id: string;
  idList: string;
  name: string;
  desc: string;
  pos: number;
  closed: boolean;
  dateLastActivity: string;
  cardRole: string | null;
  attachments: TrelloAttachment[];
  checklists: unknown[];
}

interface TrelloList {
  id: string;
  name: string;
  pos: number;
  closed: boolean;
}

interface TrelloBoard {
  lists: TrelloList[];
  cards: TrelloCard[];
}

export interface TrelloImportSummary {
  clusters: number;
  nodes: number;
  attachments: number;
  focus: number;
  inbox: number;
  /** Cards whose checklists came through without their items. */
  checklistsWithoutItems: string[];
}

/** Trello object ids start with the creation time in seconds, as hex. */
function createdAtFromId(id: string): Date {
  return new Date(parseInt(id.slice(0, 8), 16) * 1000);
}

const ZWNJ = String.fromCharCode(0x200c);
const BLANK_SPACER_LINE = new RegExp(`^${ZWNJ}\\s*$`, 'gm');

/** Trello pads descriptions with zero-width spacer paragraphs; drop them. */
function cleanDescription(desc: string): string | null {
  const text = desc.replace(BLANK_SPACER_LINE, '').replace(/\n{3,}/g, '\n\n').trim();
  return text || null;
}

export async function importTrello(
  db: PrismaClient,
  config: TrelloConfig,
  domainIds: Map<string, string>,
): Promise<TrelloImportSummary> {
  const board = JSON.parse(readFileSync(config.file, 'utf8')) as TrelloBoard;

  const domainId = (slug: string): string => {
    const id = domainIds.get(slug);
    if (!id) throw new Error(`Trello config names unknown domain "${slug}"`);
    return id;
  };

  const unmappedLists = board.lists.filter((list) => !config.lists[list.name]);
  if (unmappedLists.length) {
    throw new Error(
      `Lists missing from trello.lists: ${unmappedLists.map((l) => `"${l.name}"`).join(', ')}`,
    );
  }

  // Clusters, in config order within each domain.
  const clusters = new Map<string, { id: string; domainId: string }>();
  const clusterPositions = new Map<string, number>();
  for (const cluster of config.clusters) {
    const owner = domainId(cluster.domain);
    const position = clusterPositions.get(owner) ?? 0;
    clusterPositions.set(owner, position + 1);
    const row = await db.cluster.create({
      data: { domainId: owner, slug: cluster.slug, title: cluster.title, position },
    });
    clusters.set(cluster.slug, { id: row.id, domainId: owner });
  }

  const summary: TrelloImportSummary = {
    clusters: clusters.size,
    nodes: 0,
    attachments: 0,
    focus: 0,
    inbox: 0,
    checklistsWithoutItems: [],
  };

  // Position counters: per cluster tier for the card board, per domain for focus.
  const tierPositions = new Map<string, number>();
  const focusPositions = new Map<string, number>();

  const lists = board.lists.filter((l) => !l.closed).sort((a, b) => a.pos - b.pos);
  for (const list of lists) {
    const listConfig = config.lists[list.name]!;
    if (listConfig.skip) continue;

    const cards = board.cards
      .filter((c) => c.idList === list.id && !c.closed)
      .sort((a, b) => a.pos - b.pos);

    for (const card of cards) {
      const title = card.name.trim();
      const description = cleanDescription(card.desc);
      const clusterSlug = listConfig.cluster ?? config.cardClusters[title];

      if (!clusterSlug) {
        console.warn(`  ! "${title}" (${list.name}) has no cluster; filed to the inbox`);
        await db.inboxItem.create({
          data: {
            domainId: domainId(config.inboxDomain),
            text: description ? `${title}\n\n${description}` : title,
            capturedAt: createdAtFromId(card.id),
          },
        });
        summary.inbox++;
        continue;
      }

      const cluster = clusters.get(clusterSlug);
      if (!cluster) throw new Error(`"${title}" maps to unknown cluster "${clusterSlug}"`);

      const priority = listConfig.priority ?? Priority.NEXT;
      const tierKey = `${clusterSlug}:${priority}`;
      const position = tierPositions.get(tierKey) ?? 0;
      tierPositions.set(tierKey, position + 1);

      const attachments = card.attachments.map((a, index) => ({
        name: a.name,
        mimeType: a.mimeType || null,
        byteSize: a.bytes,
        // Uploaded files need a Trello login to download, so every
        // attachment comes across as a link rather than stored bytes.
        url: a.url,
        position: index,
        createdAt: new Date(a.date),
      }));
      // A "link card" is a bare URL pasted as the card title.
      if (card.cardRole === 'link' && !attachments.some((a) => a.url === title)) {
        attachments.push({
          name: title,
          mimeType: null,
          byteSize: null,
          url: title,
          position: attachments.length,
          createdAt: createdAtFromId(card.id),
        });
      }

      const lastActivity = new Date(card.dateLastActivity);
      const node = await db.node.create({
        data: {
          clusterId: cluster.id,
          kind: listConfig.kind ?? NodeKind.TASK,
          title,
          description,
          priority,
          position,
          completedAt: listConfig.done ? lastActivity : null,
          createdAt: createdAtFromId(card.id),
          updatedAt: lastActivity,
          ...(attachments.length ? { attachments: { create: attachments } } : {}),
        },
      });
      summary.nodes++;
      summary.attachments += attachments.length;

      if (card.checklists.length) summary.checklistsWithoutItems.push(title);

      if (listConfig.focus) {
        const focusPosition = focusPositions.get(cluster.domainId) ?? 0;
        focusPositions.set(cluster.domainId, focusPosition + 1);
        await db.focusItem.create({
          data: { domainId: cluster.domainId, nodeId: node.id, position: focusPosition },
        });
        summary.focus++;
      }
    }
  }

  for (const title of Object.keys(config.cardClusters)) {
    if (!board.cards.some((c) => c.name.trim() === title)) {
      console.warn(`  ! cardClusters names "${title}", which is not in the export`);
    }
  }

  return summary;
}
