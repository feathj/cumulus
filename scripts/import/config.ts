/**
 * Shape of the import config. The config itself lives next to the data it
 * describes, under the git-ignored `data/` directory, because mapping personal
 * cards to clusters means naming them.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

import type {
  AuthorKind,
  MemoryEntryStatus,
  MemoryEntryType,
  NodeKind,
  Priority,
} from '@prisma/client';

export interface DomainConfig {
  slug: string;
  title: string;
  themeHue: number;
}

export interface ClusterConfig {
  slug: string;
  title: string;
  /** Domain slug. */
  domain: string;
}

export interface TrelloListConfig {
  /** Cluster every card on the list lands in. Omit it for status lists
   * ("Upcoming", "in process"), whose cards are routed one at a time through
   * `cardClusters`. */
  cluster?: string;
  priority?: Priority;
  kind?: NodeKind;
  /** Queue the list's cards, in list order, into their domain's focus block. */
  focus?: boolean;
  /** The list's cards are checked off, dated by their last activity. */
  done?: boolean;
  /** Ignore the list entirely, e.g. an empty divider. */
  skip?: boolean;
}

export interface TrelloConfig {
  /** Path to the board's JSON export. */
  file: string;
  clusters: ClusterConfig[];
  /** Keyed by list name. Every list in the export must appear here. */
  lists: Record<string, TrelloListConfig>;
  /** Card name -> cluster slug, for cards on lists with no cluster. */
  cardClusters: Record<string, string>;
  /** Where cards that no rule places end up, as inbox items. */
  inboxDomain: string;
}

/** A hand-written atomic entry distilled from the wiki, which only has pages. */
export interface CuratedEntryConfig {
  type: MemoryEntryType;
  status?: MemoryEntryStatus;
  author: AuthorKind;
  date: string;
  title: string;
  description: string;
  /** `[[links]]` resolve against wiki page and source titles. */
  body: string;
  rationale?: string;
  alternatives?: string;
  howToApply?: string;
  tags?: string[];
  /** Titles of curated entries this one replaces. */
  supersedes?: string[];
  /** Title of the source page or log entry it was recorded in. */
  recordedIn?: string;
}

export interface WikiPageOverride {
  type?: MemoryEntryType;
  status?: MemoryEntryStatus;
  /** For an ARCHIVED page: the title of the log entry that retired it. */
  archivedBy?: string;
}

export interface TicketCsvConfig {
  /** CSV path relative to the project folder. Columns: ID, Description, Notes. */
  file: string;
  /** Day the ticket sheet was written, used as each node's creation date. */
  date?: string;
  priority?: Priority;
  /** Ticket ID -> day it shipped. Anything absent is still open. */
  completed?: Record<string, string>;
}

export interface LlmWikiConfig {
  /** Project folder holding `wiki/` and `raw/`. `~` expands. */
  project: string;
  cluster: ClusterConfig;
  /** Recorded as the `agent` on every imported event. */
  agent: string;
  /** Wiki frontmatter `type` -> entry type, for pages that are not sources. */
  pageTypes: Record<string, MemoryEntryType>;
  /** Keyed by page title. */
  pageOverrides?: Record<string, WikiPageOverride>;
  /** Title for the entry built from the index page's Overview section. */
  overviewTitle: string;
  tickets?: TicketCsvConfig;
  entries?: CuratedEntryConfig[];
}

export interface ImportConfig {
  domains: DomainConfig[];
  trello?: TrelloConfig;
  llmWiki?: LlmWikiConfig;
}

export function expandHome(p: string): string {
  return p.startsWith('~/') ? path.join(homedir(), p.slice(2)) : p;
}

export function loadConfig(file: string): ImportConfig {
  return JSON.parse(readFileSync(file, 'utf8')) as ImportConfig;
}
