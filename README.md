# Cumulus

See [REQUIREMENTS.md](REQUIREMENTS.md) for what this is and where it's going.

Right now the repo is the data layer only: Prisma schema, the initial migration,
and a seed built from the design mockup. Next.js, tRPC, MUI, Sigma.js and the MCP
server are not wired up yet.

## Local setup

Development runs against the native Homebrew Postgres on `localhost:5432`, not a
container.

```bash
brew services start postgresql@18   # if it isn't already running
createdb cumulus_dev
createdb cumulus_shadow             # used by `prisma migrate dev` for drift detection

cp .env.example .env                # adjust the role if yours isn't `jono`
npm install
npm run db:migrate                  # applies prisma/migrations
npm run db:seed                     # ~200 nodes across the three domains
```

| Command | What it does |
| --- | --- |
| `npm run db:migrate` | Create/apply migrations from schema changes |
| `npm run db:deploy` | Apply existing migrations without generating new ones (production) |
| `npm run db:reset` | Drop, re-migrate, re-seed |
| `npm run db:seed` | Wipe and reseed (refuses to run with `NODE_ENV=production`) |
| `npm run db:studio` | Prisma Studio |
| `npm run lint` / `npm run typecheck` | ESLint (type-checked rules) / `tsc --noEmit` |

## The data model

Defined in [`prisma/schema.prisma`](prisma/schema.prisma).

```
Domain ── Cluster ── Node ── Note (many)
  │
  ├── InboxItem      unfiled captures waiting to become Nodes
  ├── FocusItem      the single ordered work queue for a domain
  └── JournalEntry   one per day, with resolved links back to Clusters and Nodes

MemoryEntry          current knowledge, scoped to a Node, Cluster, Domain or global
  ├── MemoryRevision     every change, with a snapshot of the content
  ├── MemoryLink         [[wiki links]] and supersession between entries
  └── MemoryAttachment   images and documents
MemoryEvent          append-only timeline of what happened, scoped the same way
  ├── MemoryRevision     the entry changes made during the event
  └── MemoryAttachment
```

A few decisions worth knowing before building on top of it:

**Node is one table, not two.** A todo and a standing topic are both `Node`
rows separated by a `kind` discriminator, so journals and focus blocks have one
kind of id to point at and the query layer has no union types.

**Memory is split into knowledge and events.** A `MemoryEntry` is one thing
currently believed true — a decision, fact, preference, procedure, reference or
open question. A `MemoryEvent` is something that happened — an agent's work
session, a meeting, a release. The knowledge roll-up for a scope is just its
`ACTIVE` entries, which is why `Cluster` has no summary column. The memory
timeline is events plus the revisions made outside any event.

**Memory is not a kind of Node.** Entries can belong to a domain or be global,
and a Node can't live above a cluster. The cloud view queries entries next to
nodes rather than through them.

**Memory stores only its narrowest owner.** At most one of `domainId`,
`clusterId` and `nodeId` is set, and all null means global. Ancestors aren't
copied down, so moving a node to another cluster takes its memory with it;
"everything in this domain" is an `OR` across relation filters instead.

**Entries are revised, not overwritten.** Every change writes a
`MemoryRevision` with a JSON snapshot of the content. Replacing an entry is a
`SUPERSEDES` link from the new entry to the old, and the old one moves to
`SUPERSEDED` once the new one is accepted. It's a link table rather than a
`supersededById` column so one entry can replace several.

**Index fields are first-class.** `title` and `description` are required on
every entry because they are what an agent reads in the memory index before
deciding which full entries to load.

**`Domain.themeHue` is a hue, not a hex code.** The mockup derives an entire
oklch palette per domain from a single hue (personal 155, work 250, church 65),
so that number is the real source of truth for the theme.

**Links are stored, not re-parsed.** `[[wiki links]]` resolve at write time into
`JournalClusterLink` / `JournalNodeLink` / `MemoryLink` rows, so renaming a
target doesn't silently break everything that referenced it. Journal links use
two tables rather than one nullable polymorphic table, since Prisma can express
"exactly one target" that way without check constraints.

**Ordering is explicit.** `position` on `Cluster`, `Node` (within a
`(cluster, priority)` tier) and `FocusItem` — all the places the UI supports
drag-to-reorder. `layoutX` / `layoutY` on `Cluster`, `Node` and `MemoryEntry`
persist where I dragged a bubble so the cloud simulation resumes rather than
re-seeding.

**Nothing is hard-deleted by default.** `completedAt`, `archivedAt`,
`discardedAt` and `filedAt` are timestamps rather than booleans, which is what
"recently closed" reads from. Memory entries use `status` instead, since each
transition is also recorded as a revision.

## Known gaps

- The "at most one owner" rule on `MemoryEntry` / `MemoryEvent` and the
  "exactly one of entry or event" rule on `MemoryAttachment` are CHECK
  constraints added by hand to the migration SQL. Prisma doesn't model them, so
  carry them over if the migration is ever regenerated.
- A `FocusItem`'s node should belong to the same domain as the item. That
  invariant is cross-table and isn't enforced in the database; it belongs in the
  tRPC layer.
- Resolving `[[wiki links]]` in entry bodies into `RELATES_TO` rows, and writing
  a `MemoryRevision` alongside every entry change, are the write path's job.
  Links from entries to nodes aren't modelled yet.
- No full-text search over memory yet. Postgres `tsvector` over title,
  description and body is the likely first step.
- Attachment bytes live on disk and aren't part of JSON export/import yet.
- `npm audit` reports a high-severity advisory in `deepmerge-ts`, reachable only
  through the Prisma CLI's config loader (dev-only, never in the runtime client).
  The only fix on offer downgrades `prisma` to 6.12, so it's being left alone.
