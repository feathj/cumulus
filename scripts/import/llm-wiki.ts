/**
 * LLM-wiki project -> one cluster of memory.
 *
 * The wiki's layers map onto Cumulus like this:
 *
 *   wiki/<page>.md          MemoryEntry, typed from its frontmatter `type`
 *   wiki/index.md Overview  MemoryEntry — the cluster's overview synthesis
 *   wiki/sources/<page>.md  MemoryEvent LOG — the document, meeting or commit
 *                           batch that arrived
 *   wiki/log.md entries     MemoryEvent SESSION, plus a revision on every page
 *                           the entry links to
 *   [[links]]               MemoryLink between entries, MemoryReference
 *                           between an entry and an event
 *   raw/<tickets>.csv       Nodes, when configured
 *
 * It is not 1:1. The wiki keeps no history of page content, so every revision
 * snapshots the page as it stands today. And the wiki holds whole pages, never
 * atomic decisions or facts — the few in the config are hand-distilled from
 * the log, to exercise supersession and review against real material.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  AuthorKind,
  MemoryEntryStatus,
  MemoryEntryType,
  MemoryEventKind,
  MemoryLinkKind,
  MemoryRevisionAction,
  NodeKind,
  Priority,
} from '@prisma/client';
import type { Prisma, PrismaClient } from '@prisma/client';
import { parse as parseYaml } from 'yaml';

import { expandHome } from './config';
import type { CuratedEntryConfig, LlmWikiConfig } from './config';

const { AGENT } = AuthorKind;
const { PENDING, ACTIVE, SUPERSEDED, ARCHIVED } = MemoryEntryStatus;
const { CREATED, UPDATED } = MemoryRevisionAction;

interface WikiPage {
  /** File name without `.md`, which links sometimes use instead of the title. */
  stem: string;
  title: string;
  type: string;
  created: string;
  updated: string;
  tags: string[];
  origin: string | null;
  body: string;
}

interface LogEntry {
  date: string;
  kind: string;
  title: string;
  body: string;
}

/** The fields a revision snapshots. */
interface EntryContent {
  type: MemoryEntryType;
  title: string;
  description: string;
  body: string;
  rationale: string | null;
  alternatives: string | null;
  howToApply: string | null;
}

export interface LlmWikiImportSummary {
  entries: number;
  events: number;
  revisions: number;
  links: number;
  references: number;
  tickets: number;
  unresolvedLinks: string[];
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function at(iso: string, hour: number, minutesLater = 0): Date {
  const date = new Date(`${iso}T${String(hour).padStart(2, '0')}:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Not a date: "${iso}"`);
  return new Date(date.getTime() + minutesLater * 60_000);
}

function lastDate(text: string): string | undefined {
  return text.match(/\d{4}-\d{2}-\d{2}/g)?.at(-1);
}

function readPage(file: string): WikiPage {
  const text = readFileSync(file, 'utf8');
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  const front = (match ? parseYaml(match[1]!) : {}) as Record<string, unknown>;
  const str = (value: unknown): string | null =>
    typeof value === 'string' ? value : typeof value === 'number' ? String(value) : null;
  const tags: unknown = front.tags;
  const stem = path.basename(file, '.md');
  const created = str(front.created);
  if (!created) throw new Error(`Wiki page has no created date: ${file}`);

  return {
    stem,
    title: str(front.title) ?? stem,
    type: str(front.type) ?? '',
    created,
    updated: str(front.updated) ?? created,
    tags: Array.isArray(tags)
      ? (tags as unknown[]).filter((t): t is string => typeof t === 'string')
      : [],
    origin: str(front.origin),
    body: (match ? text.slice(match[0].length) : text).trim(),
  };
}

/** `## [YYYY-MM-DD] kind | title` headers, each followed by free text. */
function readLog(text: string): LogEntry[] {
  const headers = [...text.matchAll(/^## \[(\d{4}-\d{2}-\d{2})\] ([^|\n]+?) \| (.+)$/gm)];
  return headers.map((m, i) => ({
    date: m[1]!,
    kind: m[2]!.trim(),
    title: m[3]!.trim(),
    body: text.slice((m.index ?? 0) + m[0].length, headers[i + 1]?.index ?? text.length).trim(),
  }));
}

/** The Overview section, and each catalog line's one-line description. */
function readIndex(text: string): { overview: string; descriptions: Map<string, string> } {
  const descriptions = new Map<string, string>();
  for (const m of text.matchAll(/^- \[\[([^\]|#]+)[^\]]*\]\] — (.+)$/gm)) {
    descriptions.set(m[1]!.trim(), m[2]!.trim());
  }
  const overview = /## Overview\n([\s\S]*?)\n(?:\*A catalog|## )/.exec(text)?.[1]?.trim() ?? '';
  return { overview, descriptions };
}

/**
 * `[[Target]]`, `[[Target|alias]]` and `[[Target#heading]]`. Hard-wrapped
 * prose can break a long link across lines, so whitespace is collapsed.
 */
function wikiLinks(body: string): { target: string; label: string }[] {
  return [...body.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => {
    const [ref = '', alias] = m[1]!.replace(/\s+/g, ' ').split('|');
    return { target: ref.split('#')[0]!.trim(), label: (alias ?? ref).trim() };
  });
}

/** A fallback index description: the first sentence of the first prose paragraph. */
function firstSentence(body: string): string {
  const paragraph = body.split(/\n\s*\n/).find((p) => /^[A-Za-z*`_]/.test(p.trim())) ?? body;
  const flat = paragraph.replace(/\s+/g, ' ').trim();
  const sentence = /^(.+?[.!?])(\s|$)/.exec(flat)?.[1] ?? flat;
  return sentence.length > 200 ? `${sentence.slice(0, 197)}...` : sentence;
}

/** Enough CSV for a spreadsheet export: quoted fields and doubled quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function snapshot(content: EntryContent, status: MemoryEntryStatus): Prisma.InputJsonObject {
  return { ...content, status };
}

function curatedContent(entry: CuratedEntryConfig): EntryContent {
  return {
    type: entry.type,
    title: entry.title,
    description: entry.description,
    body: entry.body,
    rationale: entry.rationale ?? null,
    alternatives: entry.alternatives ?? null,
    howToApply: entry.howToApply ?? null,
  };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export async function importLlmWiki(
  db: PrismaClient,
  config: LlmWikiConfig,
  domainIds: Map<string, string>,
): Promise<LlmWikiImportSummary> {
  const project = expandHome(config.project);
  const wikiDir = path.join(project, 'wiki');
  const markdownIn = (dir: string): string[] =>
    readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .sort()
      .map((f) => path.join(dir, f));

  const pages = markdownIn(wikiDir)
    .filter((f) => !['index.md', 'log.md'].includes(path.basename(f)))
    .map(readPage);
  const sources = markdownIn(path.join(wikiDir, 'sources')).map(readPage);
  const index = readIndex(readFileSync(path.join(wikiDir, 'index.md'), 'utf8'));
  const log = readLog(readFileSync(path.join(wikiDir, 'log.md'), 'utf8'));
  if (!log.length) throw new Error(`No log entries found in ${wikiDir}/log.md`);

  const domainId = domainIds.get(config.cluster.domain);
  if (!domainId) throw new Error(`llmWiki names unknown domain "${config.cluster.domain}"`);
  const cluster = await db.cluster.create({
    data: {
      domainId,
      slug: config.cluster.slug,
      title: config.cluster.title,
      position: await db.cluster.count({ where: { domainId } }),
    },
  });
  const clusterId = cluster.id;

  const summary: LlmWikiImportSummary = {
    entries: 0,
    events: 0,
    revisions: 0,
    links: 0,
    references: 0,
    tickets: 0,
    unresolvedLinks: [],
  };

  // Link targets -> ids. Pages resolve by title or file name, since the two
  // differ once a title holds a character a file name cannot.
  const entryIds = new Map<string, string>();
  const sourceEventIds = new Map<string, string>();
  // Event id -> occurredAt, so revisions made during an event share its time.
  const eventTimes = new Map<string, Date>();

  const addRevision = async (
    entryId: string,
    action: MemoryRevisionAction,
    eventId: string | null,
    createdAt: Date,
    snap: Prisma.InputJsonObject,
    author: AuthorKind = AGENT,
  ): Promise<void> => {
    await db.memoryRevision.create({
      data: { entryId, eventId, action, author, snapshot: snap, createdAt },
    });
    summary.revisions++;
  };

  // --- Events -------------------------------------------------------------

  for (const source of sources) {
    const occurredOn = lastDate(source.title) ?? lastDate(source.origin ?? '') ?? source.created;
    const occurredAt = at(occurredOn, 12);
    const row = await db.memoryEvent.create({
      data: {
        clusterId,
        kind: MemoryEventKind.LOG,
        author: AGENT,
        agent: config.agent,
        title: source.title,
        body: source.body,
        tags: source.tags,
        sourceRef: source.origin,
        occurredAt,
        createdAt: at(source.created, 12),
      },
    });
    sourceEventIds.set(source.title, row.id);
    sourceEventIds.set(source.stem, row.id);
    eventTimes.set(row.id, occurredAt);
    summary.events++;
  }

  // Log entries sit after the day's sources, in log order.
  const sessions: { entry: LogEntry; id: string; at: Date }[] = [];
  for (const [i, entry] of log.entries()) {
    const occurredAt = at(entry.date, 18, i);
    const row = await db.memoryEvent.create({
      data: {
        clusterId,
        kind: MemoryEventKind.SESSION,
        author: AGENT,
        agent: config.agent,
        title: entry.title,
        body: entry.body,
        tags: [entry.kind],
        occurredAt,
      },
    });
    sessions.push({ entry, id: row.id, at: occurredAt });
    eventTimes.set(row.id, occurredAt);
    summary.events++;
  }

  // --- Entries from wiki pages ---------------------------------------------

  const imported: { page: WikiPage; id: string; content: EntryContent; status: MemoryEntryStatus }[] =
    [];
  for (const page of pages) {
    const override = config.pageOverrides?.[page.title] ?? {};
    const type = override.type ?? config.pageTypes[page.type];
    if (!type) {
      throw new Error(`No entry type for wiki page "${page.title}" (type: ${page.type || 'none'})`);
    }
    const status = override.status ?? ACTIVE;
    const content: EntryContent = {
      type,
      title: page.title,
      description: index.descriptions.get(page.title) ?? firstSentence(page.body),
      body: page.body,
      rationale: null,
      alternatives: null,
      howToApply: null,
    };
    const row = await db.memoryEntry.create({
      data: {
        clusterId,
        ...content,
        status,
        author: AGENT,
        tags: page.tags,
        createdAt: at(page.created, 12),
        updatedAt: at(page.updated, 12),
      },
    });
    entryIds.set(page.title, row.id);
    entryIds.set(page.stem, row.id);
    imported.push({ page, id: row.id, content, status });
    summary.entries++;
  }

  // A page is created by the log entry on its creation day that links to it,
  // and revised by every later one that does.
  for (const { page, id, content, status } of imported) {
    const override = config.pageOverrides?.[page.title];
    const mentions = sessions.filter(
      ({ entry }) =>
        entry.date >= page.created &&
        wikiLinks(entry.body).some((l) => l.target === page.title || l.target === page.stem),
    );
    const createdIn = mentions.find(({ entry }) => entry.date === page.created);
    await addRevision(
      id,
      CREATED,
      createdIn?.id ?? null,
      createdIn?.at ?? at(page.created, 12),
      snapshot(content, ACTIVE),
    );

    let current: MemoryEntryStatus = ACTIVE;
    for (const mention of mentions) {
      if (mention === createdIn) continue;
      const archiving =
        status === ARCHIVED && current !== ARCHIVED && override?.archivedBy === mention.entry.title;
      if (archiving) current = ARCHIVED;
      await addRevision(
        id,
        archiving ? MemoryRevisionAction.ARCHIVED : UPDATED,
        mention.id,
        mention.at,
        snapshot(content, current),
      );
    }
    if (status === ARCHIVED && current !== ARCHIVED) {
      if (override?.archivedBy) {
        console.warn(`  ! "${page.title}" is archived by "${override.archivedBy}", which never links to it`);
      }
      await addRevision(
        id,
        MemoryRevisionAction.ARCHIVED,
        null,
        at(page.updated, 12),
        snapshot(content, ARCHIVED),
      );
    }
  }

  // --- The index Overview, as the cluster's overview synthesis ---------------

  let overviewId: string | null = null;
  if (index.overview) {
    const content: EntryContent = {
      type: MemoryEntryType.SYNTHESIS,
      title: config.overviewTitle,
      description: firstSentence(index.overview),
      body: index.overview,
      rationale: null,
      alternatives: null,
      howToApply: null,
    };
    const row = await db.memoryEntry.create({
      data: {
        clusterId,
        ...content,
        status: ACTIVE,
        author: AGENT,
        tags: ['overview'],
        createdAt: sessions[0]!.at,
        updatedAt: sessions.at(-1)!.at,
      },
    });
    overviewId = row.id;
    entryIds.set(config.overviewTitle, row.id);
    summary.entries++;

    // The log says so in prose ("Updated index.md's overview") rather than by link.
    for (const [i, session] of sessions.entries()) {
      const touched = i === 0 || /index\.md(?:'s)? overview/i.test(session.entry.body);
      if (!touched) continue;
      await addRevision(
        row.id,
        i === 0 ? CREATED : UPDATED,
        session.id,
        session.at,
        snapshot(content, ACTIVE),
      );
    }
  }

  // --- Hand-distilled atomic entries -----------------------------------------

  const curated = config.entries ?? [];
  const replacedBy = new Map<string, CuratedEntryConfig>();
  for (const entry of curated) {
    if (entry.status === PENDING) continue;
    for (const old of entry.supersedes ?? []) replacedBy.set(old, entry);
  }

  // Each entry lands at the moment of the event it was recorded in, so the
  // timeline never shows a revision ahead of its event.
  const sessionIds = new Map(sessions.map((s) => [s.entry.title, s.id]));
  const recordings = new Map<string, { eventId: string | null; at: Date }>();
  for (const entry of curated) {
    if (!entry.recordedIn) {
      recordings.set(entry.title, { eventId: null, at: at(entry.date, 12) });
      continue;
    }
    const eventId = sessionIds.get(entry.recordedIn) ?? sourceEventIds.get(entry.recordedIn);
    const eventAt = eventId ? eventTimes.get(eventId) : undefined;
    if (!eventId || !eventAt) {
      throw new Error(`"${entry.title}" is recorded in unknown event "${entry.recordedIn}"`);
    }
    recordings.set(entry.title, { eventId, at: eventAt });
  }

  const curatedIds = new Map<string, string>();
  for (const entry of curated) {
    if (entryIds.has(entry.title)) throw new Error(`Curated entry "${entry.title}" clashes with a page`);
    const row = await db.memoryEntry.create({
      data: {
        clusterId,
        ...curatedContent(entry),
        status: replacedBy.has(entry.title) ? SUPERSEDED : (entry.status ?? ACTIVE),
        author: entry.author,
        tags: entry.tags ?? [],
        createdAt: recordings.get(entry.title)!.at,
        updatedAt: recordings.get(entry.title)!.at,
      },
    });
    entryIds.set(entry.title, row.id);
    curatedIds.set(entry.title, row.id);
    summary.entries++;
  }

  for (const entry of curated) {
    const id = curatedIds.get(entry.title)!;
    const recording = recordings.get(entry.title)!;

    await addRevision(
      id,
      CREATED,
      recording.eventId,
      recording.at,
      snapshot(curatedContent(entry), entry.status === PENDING ? PENDING : ACTIVE),
      entry.author,
    );

    for (const oldTitle of entry.supersedes ?? []) {
      const oldId = curatedIds.get(oldTitle);
      const old = curated.find((c) => c.title === oldTitle);
      if (!oldId || !old) throw new Error(`"${entry.title}" supersedes unknown entry "${oldTitle}"`);
      await db.memoryLink.create({
        data: { fromEntryId: id, toEntryId: oldId, kind: MemoryLinkKind.SUPERSEDES },
      });
      summary.links++;
      // A pending replacement is only a proposal.
      if (replacedBy.get(oldTitle) !== entry) continue;
      await addRevision(
        oldId,
        MemoryRevisionAction.SUPERSEDED,
        recording.eventId,
        new Date(recording.at.getTime() + 60_000),
        snapshot(curatedContent(old), SUPERSEDED),
        entry.author,
      );
    }
  }

  // --- [[links]] ---------------------------------------------------------------

  const seen = new Set<string>();
  const unresolved = new Set<string>();

  const reference = async (entryId: string, eventId: string, label: string): Promise<void> => {
    const key = `ref:${entryId}:${eventId}`;
    if (seen.has(key)) return;
    seen.add(key);
    await db.memoryReference.create({ data: { entryId, eventId, label } });
    summary.references++;
  };

  const linkFromEntry = async (entryId: string, body: string): Promise<void> => {
    for (const { target, label } of wikiLinks(body)) {
      const toEntry = entryIds.get(target);
      if (toEntry) {
        const key = `link:${entryId}:${toEntry}`;
        if (toEntry === entryId || seen.has(key)) continue;
        seen.add(key);
        await db.memoryLink.create({
          data: { fromEntryId: entryId, toEntryId: toEntry, kind: MemoryLinkKind.RELATES_TO, label },
        });
        summary.links++;
        continue;
      }
      const toEvent = sourceEventIds.get(target);
      if (toEvent) await reference(entryId, toEvent, label);
      else unresolved.add(target);
    }
  };

  for (const { page, id } of imported) await linkFromEntry(id, page.body);
  if (overviewId) await linkFromEntry(overviewId, index.overview);
  for (const entry of curated) await linkFromEntry(curatedIds.get(entry.title)!, entry.body);

  // Source pages link out to the concept pages they fed.
  for (const source of sources) {
    const eventId = sourceEventIds.get(source.title)!;
    for (const { target, label } of wikiLinks(source.body)) {
      const entryId = entryIds.get(target);
      if (entryId) await reference(entryId, eventId, label);
      else if (!sourceEventIds.has(target)) unresolved.add(target);
    }
  }
  summary.unresolvedLinks = [...unresolved].sort();

  // --- Tickets -------------------------------------------------------------------

  if (config.tickets) {
    const [header = [], ...rows] = parseCsv(
      readFileSync(path.join(project, config.tickets.file), 'utf8'),
    );
    const column = (name: string): number => {
      const i = header.findIndex((h) => h.trim().toLowerCase() === name);
      if (i < 0) throw new Error(`Ticket CSV has no "${name}" column`);
      return i;
    };
    const [idCol, descriptionCol, notesCol] = [column('id'), column('description'), column('notes')];

    for (const row of rows) {
      const ticket = row[idCol]?.trim();
      const text = row[descriptionCol]?.trim();
      if (!ticket || !text) continue;
      const shippedOn = config.tickets.completed?.[ticket];
      await db.node.create({
        data: {
          clusterId,
          kind: NodeKind.TASK,
          title: `${ticket}: ${text}`,
          description: row[notesCol]?.trim() || null,
          priority: config.tickets.priority ?? Priority.NEXT,
          position: summary.tickets,
          completedAt: shippedOn ? at(shippedOn, 17) : null,
          ...(config.tickets.date ? { createdAt: at(config.tickets.date, 12) } : {}),
        },
      });
      summary.tickets++;
    }
  }

  return summary;
}
