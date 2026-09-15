# Cumulus

See [REQUIREMENTS.md](REQUIREMENTS.md) for what this is and where it's going.

A prototype of the UI is in place: domain and cluster clouds (Sigma.js with
d3-force physics), the card board, and the memory view, over a tRPC API and
service layer, with Vitest against real Postgres. The first write paths are
there too: dragging cards on the board to reorder them or change their
priority; capturing ideas from the header and refining, filing or archiving
them in the inbox; and archiving and restoring cards. Focus, journal, the
remaining writes and the MCP server are still to come.

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
npm run db:seed                     # mockup data: ~200 nodes across three domains
npm run db:import                   # ...or real data instead; see below
npm run dev                         # http://localhost:3000
```

`npm test` needs `TEST_DATABASE_URL` in `.env` (see `.env.example`). It must
point somewhere other than the development database: the suite migrates it on
every run — creating it if needed — and empties every table between tests.

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve it |
| `npm test` / `npm run test:watch` | Vitest, once / in watch mode |
| `npm run lint` | ESLint: Next.js rules plus type-checked typescript-eslint |
| `npm run typecheck` | Generate Next's route types, then `tsc --noEmit` |
| `npm run db:migrate` | Create/apply migrations from schema changes |
| `npm run db:deploy` | Apply existing migrations without generating new ones (production) |
| `npm run db:reset` | Drop, re-migrate, re-seed |
| `npm run db:seed` | Wipe and load the mockup data (refuses to run with `NODE_ENV=production`) |
| `npm run db:import` | Wipe and load real data from `data/` (same production guard) |
| `npm run db:studio` | Prisma Studio |

## The UI

| Route | View |
| --- | --- |
| `/` | Redirects to the first domain |
| `/[domain]` | Domain cloud: clusters orbiting the domain, sized by open cards. The + in the corner adds a cluster |
| `/[domain]/inbox` | Inbox: refine a capture, file it into a cluster as a card, or archive it |
| `/[domain]/[cluster]` | Cluster cloud: open cards in rings (now innermost), plus a memory orb |
| `/[domain]/[cluster]/cards` | Card board: Now / Next / Someday, recently completed and archived below. Drag to reorder or reprioritize |
| `/[domain]/[cluster]/memory` | Memory: Knowledge (what's believed now) and Timeline (how it got there) |

Every domain page has a capture box in the header: type, press Enter, and the
idea lands in that domain's inbox. `/` focuses it from anywhere that isn't a
text field. Filing suggests the first line as the card title and the rest as
its description, and puts the card at the end of the chosen priority.

Cards on the board and orbs in the cluster cloud show small icons when there's
more inside: lines of text when the description says something besides its
links, and a link icon when the description or a link attachment has a URL —
YouTube's play button if any of them is a video. Files uploaded to Trello are
stored as URLs but have a MIME type, so they count as attachments, not links.
The icon paths live in `src/lib/icons.ts` so the cloud's canvas can draw the
same shapes as the board.

A new cluster's slug comes from its name, skipping any slug already taken —
archived clusters included — and the domain's own page names (`inbox`,
`focus`, `journal`), which a cluster would otherwise hide. **Archive cluster**,
at the right of a cluster's toolbar, asks first, then returns to the domain
cloud with an Undo. An archived cluster's cards, notes and memory are kept but
drop out of every count.

Confirmations like these go to one snackbar per domain (`NoticeProvider` in
`src/components/notice.tsx`), so an Undo outlives the drawer or page that
offered it.

Any cluster view takes `?node=<id>` to open a card's detail drawer; it's set
with the History API, so selecting a card doesn't round-trip to the server.
The drawer is where a card is archived (with Undo) or restored. An archived card
leaves the board, the cloud, the counts and the focus block, but keeps its
notes, attachments and memory. Memory takes `#entry-<id>` / `#event-<id>` to
jump to and flash a row.

## How the code is laid out

```
src/
  app/                 App Router: layouts, pages, and the tRPC route handler
    [domain]/          domain shell (with the capture box), cloud, inbox/
      [cluster]/       cluster toolbar, card drawer, cloud, cards/, memory/
  components/
    cloud/             the physics cloud: Sigma renders, d3-force moves
    markdown.tsx       markdown with [[wiki link]] resolution
  lib/                 OKLCH→sRGB colour, palettes, formatting — pure and tested
  trpc/                tRPC <-> React Query glue for Client and Server Components
  server/
    services/          the rules: plain functions over a Prisma client
    trpc/              routers — validate input, call a service, nothing more
    errors.ts          DomainError, which services throw
    db.ts              the app's Prisma client
  test/                Vitest setup, the test database, row factories
scripts/import/        real-data importer (run with tsx, outside Next)
prisma/                schema, migrations, mockup seed
```

**Rules live in services, not routers.** The web UI won't be the only thing
writing data — the MCP server will call the same services. So invariants (a
revision on every memory change, resolved `[[links]]`, one memory owner) belong
in `src/server/services`, and a router stays a line or two of input validation
and a service call.

**Services take the database as an argument.** Each function's first parameter
is a `Db`: the Prisma client or an open transaction. Callers can compose several
services in one `db.$transaction`, and tests pass the test database without any
module mocking.

**Services throw `DomainError`, not `TRPCError`.** A middleware in
`src/server/trpc/init.ts` maps a `NotFoundError` to `NOT_FOUND` and so on, so
services never import tRPC. Anything else becomes `INTERNAL_SERVER_ERROR`.

**Server Components prefetch, Client Components read.** A page awaits
`getQueryClient().prefetchQuery(trpc.x.queryOptions())` from `@/trpc/server` —
an in-process call, no HTTP — and wraps its children in `<HydrateClient>`. A
Client Component then calls `useSuspenseQuery(useTRPC().x.queryOptions())` with
the same options and gets the data without a refetch. superjson carries `Date`s
across both hops. The domain layout calls `connection()` so everything under it
renders per request rather than at build time.

**Colour is specified in OKLCH and converted.** The mockup's palette is OKLCH,
derived per domain from `themeHue`. WebGL and MUI's palette helpers only parse
sRGB, so `src/lib/color.ts` converts, and `domainPalette(hue)` gives every
component the same accent colours.

**Tests run against real Postgres.** No Prisma mocks: service tests exercise
the actual queries. `src/test/global-setup.ts` runs `prisma migrate deploy`
against `TEST_DATABASE_URL` once per run, every test starts from empty tables,
and test files run one at a time because they share the database. Router tests
use `createCaller` with the test database to check validation and error mapping
without HTTP.

## The cloud

`src/components/cloud/` splits the work:

- **d3-force owns positions.** Three forces: `collide` (orbs shove each other
  and the hub — this is what makes a flung orb push its neighbours), `orbit`
  (pulls each orb toward its ring, stretched into an ellipse matching the
  viewport), and `drift` (a gentle push along the ring). The simulation never
  fully cools, which keeps the drift alive; with `prefers-reduced-motion` there
  is no drift and it stops.
- **Sigma renders.** Orbs use `@sigma/node-border` (a ring plus a fill); labels
  are drawn inside each orb by a custom canvas label function that wraps and
  fits the text, caching each fit.
- **Sizes are graph units.** `itemSizesReference: "positions"` with a
  `(ratio) => ratio` zoom function makes an orb's drawn radius and its collision
  radius the same number, and a fixed custom bounding box stops Sigma rescaling
  the view as orbs move.
- **Dragging** pins the held orb in the simulation (`fx`/`fy`), holds the camera
  still, and on release gives the orb the pointer's last velocity.
- **Colours are flattened.** Sigma's WebGL programs render translucent colours
  far brighter than a browser would, so `CloudCanvas` resolves each `rgba()`
  against the page background first. Orbs are therefore opaque.

Sigma is imported inside an effect, so the cloud renders nothing on the server
and appears once the client has loaded it. Each cloud also renders a list of its
orbs that is hidden until keyboard focus enters it.

**Cells.** Inside each cluster orb in the domain cloud, a few of its open cards
drift as faint rings with tiny titles, sized by priority: now cards biggest and
brightest, someday cards smallest. They're decoration, not controls: nothing
about them can be hovered or clicked. `cells.ts` wanders them faster than the
orbs move, keeps them inside a membrane just within the orb's edge and out of
its nucleus — the space around the orb's label, which is shaded a little darker
so the name stays readable — and every 9–18 seconds fades one out so another
card from the cluster can fade in, working through a shuffled pool (up to 60
cards, now first) so every card surfaces in time. Bigger orbs hold more, up to
six. They're drawn on their own canvas between Sigma's node and label layers,
and hold still with reduced motion.

**Floating.** The domain cloud's orbs don't drift around their ring: they share
one ring, and turning it just jams them together. Instead each is held near a
home spot on the ring by a soft spring whose anchor wanders on a few slow,
unrelated waves, so the orbs meander in place as if suspended in cytoplasm.
Dropping a dragged orb makes that spot its new home. The cluster cloud keeps
the drift, where each ring of cards turns as a whole.

**Labels on hover.** Sigma redraws a hovered node on a WebGL layer above the
labels, which suits labels beside a node but covered ours, drawn inside. That
layer is hidden; hovering only adds the ring.

## Importing real data

`npm run db:import` reads `data/import.config.json` (or a path passed after
`--`). `data/` is git-ignored: it holds the raw exports and a config that names
personal cards, and neither belongs in the repo.

The config lists the domains to create, then optionally:

**`trello`** — a board's JSON export. Every list must appear under `lists`.
Topic lists name a `cluster`. Status lists ("Upcoming", "in process", "Done")
name no cluster and instead set `priority`, `kind`, `focus` or `done`; each of
their cards is routed to a cluster through `cardClusters`, by card name. A card
nothing places is filed to the inbox with a warning, so a fresh export with new
cards still imports.

**`llmWiki`** — one LLM-wiki project folder, imported as a single cluster:

| Wiki | Cumulus |
| --- | --- |
| `wiki/<page>.md` | `MemoryEntry`, typed by `pageTypes` from the frontmatter `type` |
| `wiki/index.md` Overview | A `SYNTHESIS` entry for the cluster |
| `wiki/sources/<page>.md` | `MemoryEvent` (`LOG`), `sourceRef` from `origin` |
| `wiki/log.md` entries | `MemoryEvent` (`SESSION`), plus a revision on each page it links to |
| `[[links]]` | `MemoryLink` between entries, `MemoryReference` to source events |
| ticket CSV | `Node`s, closed per `tickets.completed` |

It is deliberately not 1:1. The wiki has no page history, so every revision
snapshots the page as it is today. And it has no single-fact entries at all —
the `entries` in the config are distilled by hand from the log, so decisions,
supersession and review get exercised against real material.

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
  └── MemoryLink         [[wiki links]] and supersession between entries
MemoryEvent          append-only timeline of what happened, scoped the same way
  └── MemoryRevision     the entry changes made during the event
MemoryReference      [[wiki links]] between an entry and an event

Attachment           a stored file or a link, on a Node, MemoryEntry or MemoryEvent
```

A few decisions worth knowing before building on top of it:

**Node is one table, not two.** A todo and a standing topic are both `Node`
rows separated by a `kind` discriminator, so journals and focus blocks have one
kind of id to point at and the query layer has no union types. A node's
`description` is mine to write; anything an agent maintains about it lives in
node-scoped memory.

**Memory is split into knowledge and events.** A `MemoryEntry` is something
currently believed true. A `MemoryEvent` is something that happened or arrived —
an agent's work session, a meeting, a batch of commits, a design doc. The
knowledge roll-up for a scope is just its `ACTIVE` entries, which is why
`Cluster` has no summary column. The memory timeline is events plus the
revisions made outside any event.

**Entries come in two grains.** Most types (`DECISION`, `FACT`, `PROCEDURE`, …)
hold one thing, so each can be superseded on its own. `SYNTHESIS` is a whole
write-up about a subject — an LLM-wiki page. Importing a real wiki showed both
are needed: agents naturally maintain pages, and pages are what a person reads,
but a page can't be partly superseded. The memory view keeps them apart: single
entries are shown in full, write-ups open on demand.

**Memory is not a kind of Node.** Entries can belong to a domain or be global,
and a Node can't live above a cluster. The cloud view queries entries next to
nodes rather than through them.

**Memory stores only its narrowest owner.** At most one of `domainId`,
`clusterId` and `nodeId` is set, and all null means global. Ancestors aren't
copied down, so moving a node to another cluster takes its memory with it;
"everything in this cluster" is an `OR` across relation filters instead (see
`src/server/services/scope.ts`).

**Entries are revised, not overwritten.** Every change writes a
`MemoryRevision` with a JSON snapshot of the content. Replacing an entry is a
`SUPERSEDES` link from the new entry to the old, and the old one moves to
`SUPERSEDED` once the new one is accepted. It's a link table rather than a
`supersededById` column so one entry can replace several.

**Index fields are first-class.** `title` and `description` are required on
every entry because they are what an agent reads in the memory index before
deciding which full entries to load.

**Attachments are files or links.** An `Attachment` either points at bytes we
store (`storageKey`) or somewhere else (`url`). Trello uploads can't be fetched
without a Trello login, so everything from the board arrives as a link.

**`Domain.themeHue` is a hue, not a hex code.** The mockup derives an entire
oklch palette per domain from a single hue (personal 155, work 250, church 65),
so that number is the real source of truth for the theme.

**Links are stored, not re-parsed.** `[[wiki links]]` resolve at write time into
`JournalClusterLink` / `JournalNodeLink` / `MemoryLink` / `MemoryReference`
rows, so renaming a target doesn't silently break everything that referenced
it. Journal links use two tables rather than one nullable polymorphic table,
since Prisma can express "exactly one target" that way without check
constraints.

**Ordering is explicit.** `position` on `Cluster`, `Node` (within a
`(cluster, priority)` tier), `FocusItem` and `Attachment` — all the places the
UI supports drag-to-reorder. `layoutX` / `layoutY` on `Cluster`, `Node` and
`MemoryEntry` persist where I dragged a bubble so the cloud simulation resumes
rather than re-seeding.

**Nothing is hard-deleted by default.** `completedAt`, `archivedAt` and
`filedAt` are timestamps rather than booleans, which is what "recently closed"
and "archived" read from. Domains, clusters, cards and inbox items all archive
the same way. A filed inbox item stays behind, pointing at the card it became. Memory entries use `status` instead, since each
transition is also recorded as a revision.

## Known gaps

- Writes so far are card moves, inbox capture/refine/file/archive, and card
  archive/restore. Cards still can't be edited or completed, memory has no
  review actions, and the focus and journal sections are placeholders.
- The board and inbox list only the 20 most recently archived items. Anything
  older is still in the database but has no way back in the UI yet.
- Archiving a card drops it from the focus block for good; restoring doesn't
  put it back.
- There's no list of archived clusters yet. Once the Undo notice is gone,
  bringing one back means calling `cluster.restore` with its id. Clusters
  can't be renamed either.
- A card move renumbers its siblings too, which bumps their `updatedAt`. Two
  moves in the same cluster from different tabs at once could interleave; one
  person on one laptop makes that unlikely, but it isn't locked against.
- The cloud handles mouse dragging only; touch drags pan the camera. Dragged
  positions aren't saved to `layoutX` / `layoutY` yet.
- In a big cluster the outer "someday" orbs are small enough that their labels
  truncate until you zoom in.
- The memory page ships every entry and event body up front — about 1.2 MB of
  HTML for the imported continuity wiki. Write-up bodies should load on demand.
- An unknown cluster renders the not-found page but with a 200 status, because
  the domain's `loading.tsx` starts streaming before the cluster layout calls
  `notFound()`.
- Four rules are CHECK constraints added by hand to the migration SQL: at most
  one owner on `MemoryEntry` and on `MemoryEvent`, and exactly one owner and
  exactly one of `storageKey` / `url` on `Attachment`. Prisma doesn't model
  them, so carry them over if the migration is ever regenerated.
- A `FocusItem`'s node should belong to the same domain as the item. That
  invariant is cross-table and isn't enforced in the database; it belongs in the
  service layer, with the focus-block write path.
- Resolving `[[wiki links]]` in entry bodies into link rows, and writing a
  `MemoryRevision` alongside every entry change, are the memory service's job
  once it has a write path. Links from entries to nodes aren't modelled yet.
- No auth. Cumulus runs on my laptop; add it before it runs anywhere else.
- No subtasks. Trello checklists have no home — though the export didn't include
  checklist items anyway.
- No full-text search over memory yet; the memory view filters in the browser.
  Postgres `tsvector` over title, description and body is the likely first step.
- Attachment bytes live on disk and aren't part of JSON export/import yet.
- Still on Prisma 6. Prisma 7 is out; upgrading is its own piece of work.
- `npm audit` reports a high-severity advisory in `deepmerge-ts`, reachable only
  through the Prisma CLI's config loader (dev-only, never in the runtime client).
  The only fix on offer downgrades `prisma` to 6.12, so it's being left alone.
