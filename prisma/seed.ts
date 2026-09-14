/**
 * Development seed.
 *
 * Content is lifted from the design mockup in `mockup/` so the data layer has
 * something realistic to build the cloud, card and memory views against.
 *
 * This wipes and rebuilds every domain, so it is destructive by design and
 * refuses to run against a production database.
 */
import 'dotenv/config';

import {
  AuthorKind,
  MemoryEntryStatus,
  MemoryEntryType,
  MemoryEventKind,
  MemoryLinkKind,
  MemoryRevisionAction,
  NodeKind,
  Priority,
  PrismaClient,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';

const db = new PrismaClient();

// ---------------------------------------------------------------------------
// Source data
// ---------------------------------------------------------------------------

/** `Title|tier|kind` — tier 1/2/3 maps to Now/Next/Someday, kind defaults to task. */
type NodeSpec = string;

/** `global`, `domain`, `clusterSlug`, or `clusterSlug:Node title`. */
type ScopeSpec = string;

interface ClusterSeed {
  slug: string;
  title: string;
  nodes: NodeSpec[];
}

interface EntrySeed {
  scope: ScopeSpec;
  type: MemoryEntryType;
  date: string;
  title: string;
  description: string;
  /** `[[Entry title]]` links resolve against entries in the same seed group. */
  body: string;
  rationale?: string;
  alternatives?: string;
  howToApply?: string;
  author: AuthorKind;
  status?: MemoryEntryStatus;
  recallCount: number;
  /** Titles of entries this one replaces. */
  supersedes?: string[];
}

interface EventSeed {
  scope: ScopeSpec;
  kind: MemoryEventKind;
  date: string;
  title: string;
  body: string;
  author: AuthorKind;
  /** Titles of entries first recorded during this event. */
  creates?: string[];
}

interface NodeDetailSeed {
  description?: string;
  notes?: { date: string; text: string }[];
}

interface DomainSeed {
  slug: string;
  title: string;
  themeHue: number;
  clusters: ClusterSeed[];
  entries: EntrySeed[];
  events: EventSeed[];
  /** Keyed by `clusterSlug:node title`. */
  details: Record<string, NodeDetailSeed>;
  journal: Record<string, string>;
  inbox: string[];
}

const { DECISION, FACT, PREFERENCE, PROCEDURE, QUESTION } = MemoryEntryType;
const { PENDING, ACTIVE, SUPERSEDED } = MemoryEntryStatus;
const { SESSION, LOG } = MemoryEventKind;
const { USER, AGENT } = AuthorKind;

/** Memory that holds across every domain. */
const GLOBAL_ENTRIES: EntrySeed[] = [
  {
    scope: 'global',
    type: PREFERENCE,
    date: '2026-08-01',
    recallCount: 20,
    author: USER,
    title: 'Small, concrete next actions',
    description: 'Break work into small, concrete next actions; vague items never get started',
    body: 'Split anything bigger than a sitting into steps that each have an obvious first move. Open-ended items sit untouched no matter how important they are.',
    rationale: 'Attention is the constraint, not effort. A clear first step is what gets work started.',
    howToApply:
      'When proposing tasks or plans, lead with the next physical action rather than the goal, and keep each item small enough to finish in one sitting.',
  },
];

const DOMAINS: DomainSeed[] = [
  {
    slug: 'personal',
    title: 'Personal',
    themeHue: 155,
    clusters: [
      {
        slug: 'books',
        title: 'Books to read',
        nodes: [
          'The Power Broker|1',
          'Piranesi|2',
          'Thinking in Systems|1',
          'Annals of the Former World|3',
          'The Dawn of Everything|3',
          'Deep Work|2',
          'Seeing Like a State|3',
          'The Making of the Atomic Bomb|3',
          'A Pattern Language|2',
          'Braiding Sweetgrass|2',
          'The Overstory|2',
          'Working in Public|2',
          'The Goal|3',
          'Shop Class as Soulcraft|3',
        ],
      },
      {
        slug: 'screen',
        title: 'Movies & shows',
        nodes: [
          'Andor S2|1',
          'Perfect Days|2',
          'Shogun|2',
          'Severance S2|1',
          'Chernobyl|2',
          'Slow Horses|3',
          'Dune Part Two|2',
          'The Rehearsal|3',
          'Past Lives|2',
          'Totoro with the kids|2',
          'Arrival (rewatch)|3',
          'The Bear S4|3',
        ],
      },
      {
        slug: 'indoor',
        title: 'Indoor projects',
        nodes: [
          'Refinish the stair treads|1',
          'Replace hallway sconces|2',
          'Insulate the attic hatch|1',
          'Build closet shelving|2',
          'Swap the furnace filter|1',
          'Re-caulk the guest tub|2',
          'Fix the sticking pocket door|2',
          'Label the breaker panel|2',
          'Mount the bookshelf brackets|2',
          'Patch drywall in the garage|3',
          'Paint the mudroom|3',
          'Install an office dimmer|3',
          'Deep clean the range hood|3',
          'Smoke detector batteries|1',
        ],
      },
      {
        slug: 'outdoor',
        title: 'Outdoor projects',
        nodes: [
          'Regrade side-yard drainage|1',
          'Plant fall garlic|1',
          'Clean the gutters|1',
          'Rebuild the fence gate|2',
          'Prune the apple tree|2',
          'Stack and cover firewood|2',
          'Winterize the spigots|2',
          'Fix sprinkler zone 3 head|2',
          'Reseed the bare patch|3',
          'Seal the deck boards|3',
          'Build a compost bin|3',
          'Edge the front beds|3',
          'Trim back the hedge|3',
        ],
      },
      {
        slug: 'goals',
        title: 'Big goals',
        nodes: [
          'Learn Spanish|1|topic',
          'Scuba certification|1|topic',
          'Sabbath one full day a week|1|topic',
          'Run a half marathon|2|topic',
          'Read 30 books this year|2|topic',
          'Build a woodworking bench|2|topic',
          'Write the kids yearly letters|2|topic',
          'Learn to weld|3|topic',
          'Learn basic sourdough|3|topic',
          'Get comfortable ice skating|3|topic',
        ],
      },
      {
        slug: 'guitar',
        title: 'Guitar songs',
        nodes: [
          'Blackbird|1',
          'Wish You Were Here|1',
          "Ain't No Sunshine|1",
          'Little Wing|2',
          'Norwegian Wood|2',
          'Hallelujah|2',
          'Dust in the Wind|2',
          'Fast Car|2',
          'Julia|2',
          'Neon|3',
          "Cause We've Ended as Lovers|3",
          'Landslide|3',
        ],
      },
    ],
    details: {
      'goals:Learn Spanish': {
        description:
          'Target: hold a 20-minute unscripted conversation by next summer. Currently ~A2. Anki daily, weekly tutor on Tuesdays. Weakest area is past-tense conjugation and listening speed.',
        notes: [
          { date: '2026-08-24', text: 'Anki streak: 41 days. Mature cards 620.' },
          {
            date: '2026-09-01',
            text: 'Tutor said to stop translating in my head and start narrating chores out loud.',
          },
        ],
      },
      'goals:Scuba certification': {
        description:
          'Open Water cert. Classroom done, pool sessions remaining, then four open-water dives. Quarry window closes late October.',
        notes: [{ date: '2026-09-05', text: 'One open slot on the 18th.' }],
      },
      'books:The Power Broker': {
        notes: [
          {
            date: '2026-08-19',
            text: 'Made it through the Long Island parkway chapters. Slow but worth it.',
          },
        ],
      },
      'indoor:Refinish the stair treads': {
        notes: [
          { date: '2026-08-30', text: 'Belt sander rental is $34/day. Need 80/120/220 grit.' },
        ],
      },
    },
    entries: [
      {
        scope: 'indoor:Refinish the stair treads',
        type: DECISION,
        date: '2026-08-16',
        recallCount: 13,
        author: USER,
        title: 'Oil-based poly on the treads',
        description: 'Oil-based poly on the stair treads, water-based everywhere else',
        body: 'The treads get oil-based polyurethane. All other trim gets water-based.',
        rationale: 'Treads take the abuse and the amber tone matches the existing trim.',
        alternatives: 'Water-based throughout, faster but wrong next to a 40-year-old handrail.',
      },
      {
        scope: 'indoor:Refinish the stair treads',
        type: FACT,
        date: '2026-08-30',
        recallCount: 2,
        author: USER,
        title: 'Water-pop the treads before staining',
        description: 'A damp wipe and full dry before staining makes the treads take stain evenly',
        body: 'The test board took stain far more evenly after a damp wipe and full dry.',
        howToApply: 'Do all of the treads this way, even though it costs an extra day.',
      },
      {
        scope: 'indoor:Refinish the stair treads',
        type: PROCEDURE,
        date: '2026-08-31',
        recallCount: 9,
        author: USER,
        title: 'Tread finishing sequence',
        description: 'Sanding, staining and poly sequence that worked on the test board',
        body: 'Skipping the water-pop left blotches; see [[Water-pop the treads before staining]].\n\n```\n120 grit -> 150 grit -> water-pop\ndry 4h -> stain, wipe back\npoly x2, 220 scuff between\n```',
      },
      {
        scope: 'indoor:Insulate the attic hatch',
        type: QUESTION,
        date: '2026-09-06',
        recallCount: 1,
        author: USER,
        title: 'Attic hatch: dam or weatherstripping?',
        description: 'Open: whether the attic hatch needs an insulation dam or just weatherstripping',
        body: 'A rigid box would stop the insulation sliding off, but eats headroom on the ladder.',
      },
      {
        scope: 'goals:Learn Spanish',
        type: DECISION,
        date: '2026-08-09',
        recallCount: 18,
        author: USER,
        title: 'Narrate out loud instead of translating',
        description: 'Stop translating in my head; narrate chores out loud in Spanish',
        body: 'Narrate chores out loud even when the grammar is wrong.',
        rationale: 'Tutor was blunt: translation is a habit that caps you at A2.',
        alternatives: 'More Anki volume, which built recognition without building production.',
      },
      {
        scope: 'goals:Sabbath one full day a week',
        type: FACT,
        date: '2026-09-03',
        recallCount: 6,
        author: USER,
        title: 'The Sabbath depends on Saturday',
        description: 'The Sabbath goal only holds when Saturday errands are planned and done',
        body: 'Every week it slipped, the errands had not been done Saturday. The constraint is not willpower on Sunday.',
        howToApply: 'Plan Saturday errands ahead of time rather than guarding Sunday harder.',
      },
      {
        scope: 'guitar',
        type: FACT,
        date: '2026-08-22',
        recallCount: 5,
        author: USER,
        title: 'Fingerpicked songs stick',
        description: 'Fingerpicked pieces survive weeks off; strummed songs are forgotten',
        body: 'Blackbird came back after weeks off. The strummed songs evaporate.',
        howToApply: 'Bias the song list toward fingerstyle.',
      },
      {
        scope: 'guitar:Neon',
        type: QUESTION,
        date: '2026-09-08',
        recallCount: 0,
        author: AGENT,
        status: PENDING,
        title: 'Neon: full arrangement or intro riff?',
        description: 'Open: learn Neon properly or just the intro riff',
        body: 'The full arrangement is months of thumb independence. The intro is two weeks and most of what I want.',
      },
    ],
    events: [
      {
        scope: 'indoor:Refinish the stair treads',
        kind: LOG,
        date: '2026-08-30',
        author: USER,
        title: 'Stained the test boards',
        body: 'Two boards side by side, one water-popped and one not. The difference was obvious once the stain dried.',
        creates: ['Water-pop the treads before staining'],
      },
    ],
    journal: {
      '2026-09-08':
        'Woke up with the stair-tread plan mostly solved. Sand to 120, water-pop, then two coats.\n\nSpanish tutor at 7. Ask about [[Learn Spanish]] listening drills.\n\nGarlic needs to go in before first frost.',
      '2026-09-05':
        'Quarry has one open slot the 18th. Would finish [[Scuba certification]] before it gets cold.',
      '2026-09-02': 'Finished the Moses chapter. The scale of it is hard to hold in your head.',
    },
    inbox: [
      'Ask the neighbor what he used to seal his deck',
      'Check whether the guitar needs a new nut or just a setup',
    ],
  },
  {
    slug: 'work',
    title: 'Work',
    themeHue: 250,
    clusters: [
      {
        slug: 'ship',
        title: 'Shipping now',
        nodes: [
          'Auth migration|1|topic',
          'Billing retry logic|1',
          'Token rotation grace window|1',
          'Tenant flag rollout to 40%|1',
          'On-call runbook refresh|2',
          'Legacy cookie removal plan|2',
          'Mobile cold-start telemetry|2',
          'Session revocation endpoint|2',
          'Backfill audit log gaps|2',
          'Load test the refresh path|2',
          'Error budget dashboard|3',
          'Deprecate /v1/session|3',
          'Rate limit tuning|3',
        ],
      },
      {
        slug: 'think',
        title: 'Thinking about',
        nodes: [
          'Pricing model v3|1|topic',
          'Latency budget|2',
          'Team topology for Q4|2',
          'What breaks at 10x tenants|2',
          'Time-to-first-call|2',
          'Incident review cadence|2',
          'Multi-region story|3|topic',
          'Build vs buy: search|3',
          'Sunset plan for the old SDK|3',
          'Cost per tenant model|3',
        ],
      },
      {
        slug: 'people',
        title: 'People & 1:1s',
        nodes: [
          'Dana — growth plan|1',
          'New hire onboarding|1',
          'Marcus — scope clarity|2',
          'Priya — promo packet|2',
          'Hiring loop calibration|2',
          'Feedback for Sam|2',
          'Recognition for the auth crew|2',
          'Skip-levels this month|3',
          'Team offsite agenda|3',
          'Interview debrief backlog|3',
          '1:1 question bank|3',
        ],
      },
      {
        slug: 'admin',
        title: 'Admin',
        nodes: [
          'Q3 review packet|1',
          'Expense report|1',
          'Compliance training|2',
          'Budget forecast input|2',
          'Headcount plan draft|2',
          'Book Q4 travel|2',
          'Vendor renewal: log tooling|3',
          'Update the team charter|3',
          'Archive old Jira epics|3',
          'Refresh onboarding checklist|3',
        ],
      },
      {
        slug: 'bc',
        title: 'Business continuity',
        nodes: [
          'Runbook v3 review|1',
          'Game day: gradebook reads|1',
          'Name the failover decision owner|1',
          'DNS pre-warm automation|2',
          'Standby capacity plan|2',
          'Tabletop with support leads|2',
          'Quarterly game-day cadence|3',
          'Rewrite the SLA doc|3',
        ],
      },
    ],
    details: {
      'ship:Auth migration': {
        description:
          'Moving session auth to short-lived tokens with refresh rotation. Two services still read the legacy cookie. Rollout is behind a per-tenant flag; 18% of tenants migrated.',
        notes: [
          {
            date: '2026-08-28',
            text: 'Decision: keep the legacy cookie readable until Q4, then hard-remove.',
          },
          {
            date: '2026-09-04',
            text: 'Refresh rotation broke the mobile client on cold start. Added a 30s grace window.',
          },
        ],
      },
    },
    entries: [
      {
        scope: 'bc',
        type: DECISION,
        date: '2026-06-18',
        recallCount: 0,
        author: USER,
        title: 'Evaluate DR vendors first',
        description: 'Shortlist and evaluate three DR vendors before building anything in-house',
        body: 'Get a baseline on what managed disaster recovery costs and covers before committing engineering time.',
      },
      {
        scope: 'bc',
        type: DECISION,
        date: '2026-08-06',
        recallCount: 31,
        author: AGENT,
        title: 'Tier-1 recovery targets',
        description: 'Tier-1 RTO is 4 hours and RPO 15 minutes; everything else is tier-2 at 24 hours',
        body: 'Tier-1 covers login, course access, and gradebook reads. Everything else is tier-2 with a 24-hour RTO.',
        rationale: 'Agreed with SRE and legal in the August risk workshop.',
        alternatives:
          'A 1-hour RTO (needed active-active, roughly 3x the cost) and a 24-hour RTO (unacceptable for an institution mid-term).',
      },
      {
        scope: 'bc',
        type: DECISION,
        date: '2026-08-13',
        recallCount: 24,
        author: USER,
        title: 'Warm standby in a second region',
        description: 'Warm standby in a second region with manual promotion, not active-active',
        body: 'Standby carries replicated data and a scaled-down service footprint, sized to meet [[Tier-1 recovery targets]]. Promotion is a deliberate runbook step with a named owner, not an automatic failover.',
        alternatives:
          'Active-active (write consistency cost, and we could not justify it against the 4-hour RTO) and cold restore from backups (measured well past 4 hours).',
        supersedes: ['Evaluate DR vendors first'],
      },
      {
        scope: 'bc',
        type: FACT,
        date: '2026-08-20',
        recallCount: 17,
        author: AGENT,
        title: 'Runbooks are the continuity bottleneck',
        description: 'Game-day delays trace to stale or ambiguous runbook steps, not the platform',
        body: 'Every game-day delay so far traced to a stale or ambiguous runbook step, never to the platform.',
        howToApply: 'Weight the remaining continuity schedule toward runbook work over infrastructure.',
      },
      {
        scope: 'bc',
        type: QUESTION,
        date: '2026-08-27',
        recallCount: 12,
        author: USER,
        title: 'Who can call a failover at 2am?',
        description: 'Open: which on-call role has standing authority to promote the standby',
        body: 'Needs a named on-call role with standing authority, not an escalation chain. Still open with leadership.',
      },
      {
        scope: 'bc',
        type: PROCEDURE,
        date: '2026-09-01',
        recallCount: 6,
        author: AGENT,
        title: 'Promotion health gate',
        description: 'Checks the promotion script requires before cutting over to the standby',
        body: 'All three must pass twice, 30s apart, or the script refuses to promote.\n\n```\nreplication_lag_seconds < 900\nstandby_pool_ready_pct   > 80\nlast_snapshot_age_min    < 20\n```',
      },
      {
        scope: 'bc',
        type: FACT,
        date: '2026-09-05',
        recallCount: 2,
        author: AGENT,
        title: 'Customers think in academic terms',
        description: 'Institutions frame continuity around term boundaries, not annual uptime',
        body: 'Two customer calls in a row framed continuity around finals week and the add/drop window.',
        howToApply: 'Organize the SLA doc around the academic calendar.',
      },
      {
        scope: 'bc',
        type: DECISION,
        date: '2026-09-08',
        recallCount: 0,
        author: AGENT,
        status: PENDING,
        title: 'Search index out of continuity scope',
        description: 'Drop the multi-region search index from continuity scope',
        body: 'Search stays single-region and runs degraded during a failover.',
        rationale:
          'Degraded search was accepted in the risk workshop, and keeping the index in scope adds about two weeks.',
      },
      {
        scope: 'bc',
        type: QUESTION,
        date: '2026-09-09',
        recallCount: 0,
        author: AGENT,
        status: PENDING,
        title: 'Is RPO measured at commit or replication ack?',
        description: 'Open: which reading the 15-minute RPO promise is measured against',
        body: 'The two readings differ by roughly 40 seconds under load, which changes what the [[Tier-1 recovery targets]] can promise in writing.',
      },
      {
        scope: 'ship:Auth migration',
        type: DECISION,
        date: '2026-07-22',
        recallCount: 27,
        author: AGENT,
        title: 'Refresh token rotation',
        description: 'Refresh tokens rotate on every use, with a 30-second grace window',
        body: 'Reuse outside the grace window revokes the whole token family.',
        rationale: 'The window absorbs mobile clock skew and duplicate in-flight requests.',
        alternatives:
          'Long-lived refresh tokens with a revocation list, which meant a hot denylist on every request.',
      },
      {
        scope: 'ship:Auth migration',
        type: PROCEDURE,
        date: '2026-08-02',
        recallCount: 14,
        author: AGENT,
        title: 'Tenant flag rollout gate',
        description: 'Metrics that must hold before the auth flag advances to the next tenant cohort',
        body: 'All three must hold across a 30-minute window.\n\n```\nauth_error_rate_pct     < 0.5\np95_token_exchange_ms   < 420\ncold_start_failures_5m  < 12\n```',
      },
      {
        scope: 'ship:Auth migration',
        type: DECISION,
        date: '2026-08-28',
        recallCount: 19,
        author: AGENT,
        title: 'Legacy cookie removal timing',
        description: 'The legacy cookie stays readable until Q4, then is hard-removed',
        body: 'Two services still read the legacy cookie.',
        rationale: 'Removing it early would strand tenants that have not migrated.',
        alternatives: 'Immediate removal behind a compatibility shim, which nobody wanted to own.',
      },
      {
        scope: 'ship:Auth migration',
        type: FACT,
        date: '2026-09-04',
        recallCount: 11,
        author: AGENT,
        title: 'Cold-start failures were clock skew',
        description: 'Mobile cold-start auth failures came from device clock skew, not server latency',
        body: 'Failing devices ran 20 to 90 seconds ahead. The grace window in [[Refresh token rotation]] absorbs it.',
        howToApply: 'Check device clock skew before touching the token exchange path.',
      },
      {
        scope: 'ship',
        type: QUESTION,
        date: '2026-09-07',
        recallCount: 3,
        author: USER,
        title: 'Sequence the /v1/session sunset',
        description: 'Open: announce the /v1/session sunset before or after the cookie removal',
        body: 'Announcing together is honest but doubles the perceived blast radius.',
      },
      {
        scope: 'think:Pricing model v3',
        type: DECISION,
        date: '2026-08-18',
        recallCount: 22,
        author: USER,
        title: 'Pricing v3 meters active tenants',
        description: 'Pricing v3 meters active tenants, not seats',
        body: 'Active tenants replace seats as the billing unit.',
        rationale:
          'Seat counts were gameable and made every renewal a negotiation about definitions.',
        alternatives:
          'Seat tiers (endless disputes) and pure consumption pricing (unpredictable for institutional budgets).',
      },
      {
        scope: 'think:Cost per tenant model',
        type: FACT,
        date: '2026-08-25',
        recallCount: 16,
        author: AGENT,
        title: 'Idle capacity drives cost per tenant',
        description: 'Cost per tenant is dominated by standby capacity, not request volume',
        body: 'Top decile by spend is not top decile by traffic. Most of the bill is standby held for enrollment peaks.',
      },
      {
        scope: 'think:What breaks at 10x tenants',
        type: QUESTION,
        date: '2026-09-02',
        recallCount: 8,
        author: USER,
        title: 'First bottleneck at 10x tenants',
        description: 'Open: what breaks first at 10x tenants',
        body: 'Best guess is per-tenant config fan-out on boot, but nobody has measured it.',
      },
      {
        scope: 'think:Build vs buy: search',
        type: DECISION,
        date: '2026-09-09',
        recallCount: 0,
        author: AGENT,
        status: PENDING,
        title: 'Buy search',
        description: 'Buy a managed search product rather than building one',
        body: 'Go with a managed search option.',
        rationale:
          'Building is two engineers for two quarters, and the managed option covers ranking we would never get to.',
      },
      {
        scope: 'people',
        type: DECISION,
        date: '2026-08-11',
        recallCount: 7,
        author: USER,
        title: 'People draft their own growth plans',
        description: 'Growth plans are written by the person and pressure-tested by me',
        body: 'My job is pressure-testing scope, not authoring the ambition.',
        rationale: 'Ownership sticks when they draft it.',
      },
    ],
    events: [
      {
        scope: 'bc',
        kind: LOG,
        date: '2026-08-06',
        author: AGENT,
        title: 'Continuity risk workshop',
        body: 'SRE, legal and support leads walked the tier-1 services and agreed recovery targets. Degraded search during a failover was accepted as a known cost.',
        creates: ['Tier-1 recovery targets'],
      },
      {
        scope: 'bc',
        kind: LOG,
        date: '2026-08-13',
        author: USER,
        title: 'Standby architecture review',
        body: 'Compared active-active, warm standby and cold restore against the tier-1 targets. The vendor evaluation was dropped in favor of building in-house.',
        creates: ['Warm standby in a second region'],
      },
      {
        scope: 'bc',
        kind: LOG,
        date: '2026-08-20',
        author: AGENT,
        title: 'First failover game day: reporting service',
        body: 'Promoted the standby in staging. 38 minutes end to end, 11 of which were DNS propagation. Two runbook steps were wrong and one was missing entirely.',
        creates: ['Runbooks are the continuity bottleneck'],
      },
      {
        scope: 'bc',
        kind: LOG,
        date: '2026-09-03',
        author: AGENT,
        title: 'Runbook v2 merged, DNS pre-warm step added',
        body: 'Pre-warm drops the propagation window from 11 minutes to about 3 in staging.',
      },
      {
        scope: 'bc',
        kind: SESSION,
        date: '2026-09-09',
        author: AGENT,
        title: 'Load test of the promotion path',
        body: 'Promotion path held at 2.1x expected peak. Connection pool saturated first, at 2.4x.',
        creates: ['Is RPO measured at commit or replication ack?'],
      },
      {
        scope: 'ship:Auth migration',
        kind: SESSION,
        date: '2026-09-04',
        author: AGENT,
        title: 'Debugged mobile cold-start auth failures',
        body: 'Correlated failing sessions with device clock offsets and confirmed the 30s grace window covers the observed skew.',
        creates: ['Cold-start failures were clock skew'],
      },
      {
        scope: 'ship:Auth migration',
        kind: LOG,
        date: '2026-09-08',
        author: AGENT,
        title: 'Auth migration flag at 18% of tenants',
        body: 'Mobile cold-start error rate is flat since the 30s grace window landed.',
      },
    ],
    journal: {
      '2026-09-08':
        'Standup: [[Auth migration]] flag at 18%. Watch the mobile cold-start numbers today.\n\nPricing sync moved to Thursday.',
      '2026-09-04':
        'Cold-start bug traced to clock skew on the device, not the server. Grace window is the right fix.',
    },
    inbox: ['Idea: one-page diagram of the token refresh flow for the runbook'],
  },
  {
    slug: 'church',
    title: 'Church',
    themeHue: 65,
    clusters: [
      {
        slug: 'teach',
        title: 'Teaching prep',
        nodes: [
          'Sunday lesson — Ruth|1|topic',
          'Youth class outline|1',
          'Week 2: the threshing floor|1',
          'Week 3: redemption law|2',
          'Week 4: Obed and lineage|2',
          'Handout: covenant loyalty|2',
          'Questions for discussion|2',
          'Rework the opening story|2',
          'Read Hubbard commentary|3',
          'Find a map of Moab|3',
          'Music pairing for week 4|3',
          'Follow-up reading list|3',
        ],
      },
      {
        slug: 'serve',
        title: 'Service',
        nodes: [
          'Food pantry Saturday|1',
          'Ride schedule|1',
          'Move help for the Nguyens|1',
          'Shelf-stable protein drive|2',
          'Winter coat collection|2',
          'Yard cleanup for Sister Ann|2',
          'Meal train coordination|2',
          'Update the service calendar|2',
          'Blood drive sign-ups|3',
          'Repair the pantry shelving|3',
          'Volunteer thank-you notes|3',
        ],
      },
      {
        slug: 'care',
        title: 'Check in on',
        nodes: [
          'The Alvarez family|1',
          'Brother Kim|1',
          'Sister Ann after surgery|1',
          'The Nguyens (new baby)|2',
          'Check on Dale|2',
          'Visit the Ramirez home|2',
          'Youth who stopped coming|2',
          'Call Brother Ellis|3',
          'Widows list — monthly|3',
          'Hospital visit rotation|3',
        ],
      },
    ],
    details: {
      'teach:Sunday lesson — Ruth': {
        description:
          'Four-week arc on covenant loyalty. Week two is the threshing floor; handle it plainly and without euphemism.',
        notes: [
          {
            date: '2026-09-06',
            text: 'Open with the famine, not the genealogy. People need the stakes first.',
          },
        ],
      },
      'care:The Alvarez family': {
        notes: [{ date: '2026-09-01', text: 'Second week without a car. Offered Tuesday rides.' }],
      },
    },
    entries: [
      {
        scope: 'teach:Week 2: the threshing floor',
        type: DECISION,
        date: '2026-09-06',
        recallCount: 3,
        author: USER,
        title: 'Open week two with the famine',
        description: 'Open week two with the famine, not the genealogy',
        body: 'The genealogy moves to the last five minutes of week four.',
        rationale: 'People need the stakes before the names.',
        alternatives:
          'Opening with lineage, which is how the text is ordered but not how attention works.',
      },
      {
        scope: 'teach',
        type: FACT,
        date: '2026-08-31',
        recallCount: 11,
        author: USER,
        title: 'Lead discussion with a factual question',
        description: 'Discussion opens up when the first question is about what happened in the text',
        body: 'Interpretation first gets silence. What happened in the text gets four hands, and interpretation follows.',
        howToApply: 'Start every discussion block with a factual question.',
      },
      {
        scope: 'teach:Week 3: redemption law',
        type: QUESTION,
        date: '2026-09-09',
        recallCount: 0,
        author: AGENT,
        status: PENDING,
        title: 'How much redemption law in week three?',
        description: 'Open: how much of the legal mechanics week three actually needs',
        body: 'The legal mechanics are the point, but twenty minutes of Levirate detail lost the youth class last year.',
      },
      {
        scope: 'serve',
        type: DECISION,
        date: '2026-08-14',
        recallCount: 12,
        author: USER,
        title: 'One named coordinator per drive',
        description: 'Every drive gets one coordinator, named in the announcement',
        body: 'Name the coordinator out loud when the drive is announced.',
        rationale:
          'Unowned drives stall around 60 percent of goal. Naming someone out loud has closed the gap every time.',
        alternatives:
          'A rotating signup sheet, which spread the work and left nobody responsible for the result.',
      },
      {
        scope: 'serve',
        type: FACT,
        date: '2026-09-03',
        recallCount: 6,
        author: USER,
        title: 'Pantry runs short on shelf-stable protein',
        description: 'Beans, tuna and peanut butter run out first every month',
        body: 'Beans, tuna, and peanut butter run out first every month.',
        howToApply: 'Ask for those specifically instead of asking generally.',
      },
      {
        scope: 'care:Widows list — monthly',
        type: DECISION,
        date: '2026-08-19',
        recallCount: 9,
        author: USER,
        title: 'Standing slot for the widows list',
        description: 'The widows list gets a standing monthly slot, not good intentions',
        body: 'First Sunday afternoon, recurring.',
        rationale: 'Every month it was unscheduled, it did not happen.',
      },
    ],
    events: [
      {
        scope: 'teach:Sunday lesson — Ruth',
        kind: LOG,
        date: '2026-09-07',
        author: USER,
        title: 'Week one ran four minutes long',
        body: 'The opening story is the cut. Everything after it landed on time.',
      },
      {
        scope: 'serve:Yard cleanup for Sister Ann',
        kind: LOG,
        date: '2026-07-12',
        author: USER,
        title: 'Yard cleanup for Sister Ann, seven volunteers',
        body: 'Two hours. Needs doing again before first snow.',
      },
    ],
    journal: {
      '2026-09-07':
        'Taught week one of [[Sunday lesson — Ruth]]. Ran four minutes long. Cut the intro next time.',
      '2026-09-03': 'Pantry is short on shelf-stable protein. Ask the group Sunday.',
    },
    inbox: [],
  },
];

/** Nodes queued into each domain's focus block, by `clusterSlug:title`. */
const FOCUS: Record<string, string[]> = {
  work: ['ship:Token rotation grace window', 'bc:Runbook v3 review', 'admin:Expense report'],
  personal: ['indoor:Refinish the stair treads', 'outdoor:Plant fall garlic'],
  church: ['teach:Week 2: the threshing floor'],
};

/** Nodes already checked off, by `clusterSlug:title`. */
const COMPLETED: Record<string, string[]> = {
  work: ['admin:Compliance training', 'ship:Load test the refresh path'],
  personal: ['indoor:Swap the furnace filter'],
  church: ['serve:Ride schedule'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TIERS: Record<string, Priority> = {
  '1': Priority.NOW,
  '2': Priority.NEXT,
  '3': Priority.SOMEDAY,
};

function parseNodeSpec(spec: NodeSpec): { title: string; priority: Priority; kind: NodeKind } {
  const [title = spec, tier = '2', kind = 'task'] = spec.split('|');
  return {
    title,
    priority: TIERS[tier] ?? Priority.NEXT,
    kind: kind === 'topic' ? NodeKind.TOPIC : NodeKind.TASK,
  };
}

/** Parse an ISO day into a UTC-midnight Date, so no timezone shifts the day. */
function day(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Same day, but at a plausible working hour — memories land on a timeline. */
function dayAt(iso: string, hour = 9): Date {
  return new Date(`${iso}T${String(hour).padStart(2, '0')}:30:00.000Z`);
}

function slugify(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Resolve every `[[wiki link]]` in a journal body against known titles. */
function wikiLinks(body: string): string[] {
  return [...body.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]!.trim());
}

interface ScopeContext {
  domainId: string | null;
  clusterIds: Map<string, string>;
  /** Keyed by `clusterSlug:title`. */
  nodeIds: Map<string, string>;
}

/** The single owner column for a scope — nothing at all for global. */
function resolveScope(
  spec: ScopeSpec,
  ctx: ScopeContext,
): { domainId?: string; clusterId?: string; nodeId?: string } {
  if (spec === 'global') return {};
  if (spec === 'domain') {
    if (!ctx.domainId) throw new Error('Domain-scoped memory seeded outside a domain');
    return { domainId: ctx.domainId };
  }
  if (spec.includes(':')) {
    const nodeId = ctx.nodeIds.get(spec);
    if (!nodeId) throw new Error(`Unknown node scope "${spec}"`);
    return { nodeId };
  }
  const clusterId = ctx.clusterIds.get(spec);
  if (!clusterId) throw new Error(`Unknown cluster scope "${spec}"`);
  return { clusterId };
}

/** The content a revision captures, as it stood after that change. */
function snapshot(entry: EntrySeed, status: MemoryEntryStatus): Prisma.InputJsonObject {
  return {
    type: entry.type,
    status,
    title: entry.title,
    description: entry.description,
    body: entry.body,
    rationale: entry.rationale ?? null,
    alternatives: entry.alternatives ?? null,
    howToApply: entry.howToApply ?? null,
  };
}

/**
 * Write one group of entries and events, then the history tying them together:
 * a CREATED revision per entry (under the event that recorded it, if any), an
 * ACCEPTED revision for reviewed agent entries, SUPERSEDES links and
 * SUPERSEDED revisions for replaced entries, and a RELATES_TO link for every
 * `[[wiki link]]` in a body.
 */
async function seedMemory(
  entries: EntrySeed[],
  events: EventSeed[],
  ctx: ScopeContext,
): Promise<void> {
  const { CREATED, ACCEPTED } = MemoryRevisionAction;
  const seedsByTitle = new Map(entries.map((entry) => [entry.title, entry]));

  // An entry only reads as superseded once its replacement is accepted; a
  // pending replacement is just a proposal.
  const replacedBy = new Map<string, EntrySeed>();
  for (const entry of entries) {
    if (entry.status === PENDING) continue;
    for (const old of entry.supersedes ?? []) replacedBy.set(old, entry);
  }

  const entryIds = new Map<string, string>();
  const idOf = (title: string): string => {
    const id = entryIds.get(title);
    if (!id) throw new Error(`Unknown memory entry "${title}"`);
    return id;
  };

  for (const entry of entries) {
    const reviewed = entry.author === AGENT && entry.status !== PENDING;
    const row = await db.memoryEntry.create({
      data: {
        ...resolveScope(entry.scope, ctx),
        type: entry.type,
        status: replacedBy.has(entry.title) ? SUPERSEDED : (entry.status ?? ACTIVE),
        author: entry.author,
        title: entry.title,
        description: entry.description,
        body: entry.body,
        rationale: entry.rationale ?? null,
        alternatives: entry.alternatives ?? null,
        howToApply: entry.howToApply ?? null,
        recallCount: entry.recallCount,
        ...(entry.recallCount > 0 ? { lastRecalledAt: new Date() } : {}),
        ...(reviewed ? { reviewedAt: dayAt(entry.date, 17) } : {}),
        createdAt: dayAt(entry.date),
      },
    });
    entryIds.set(entry.title, row.id);
  }

  // Entry title -> the event it was first recorded under.
  const recordedIn = new Map<string, string>();
  for (const event of events) {
    const row = await db.memoryEvent.create({
      data: {
        ...resolveScope(event.scope, ctx),
        kind: event.kind,
        author: event.author,
        title: event.title,
        body: event.body,
        occurredAt: dayAt(event.date),
        ...(event.author === AGENT ? { agent: 'claude-code' } : {}),
      },
    });
    for (const title of event.creates ?? []) {
      idOf(title);
      recordedIn.set(title, row.id);
    }
  }

  for (const entry of entries) {
    const entryId = idOf(entry.title);
    const eventId = recordedIn.get(entry.title) ?? null;
    const reviewed = entry.author === AGENT && entry.status !== PENDING;

    await db.memoryRevision.create({
      data: {
        entryId,
        eventId,
        action: CREATED,
        author: entry.author,
        snapshot: snapshot(entry, entry.author === AGENT ? PENDING : ACTIVE),
        createdAt: dayAt(entry.date),
      },
    });

    if (reviewed) {
      await db.memoryRevision.create({
        data: {
          entryId,
          action: ACCEPTED,
          author: USER,
          snapshot: snapshot(entry, ACTIVE),
          createdAt: dayAt(entry.date, 17),
        },
      });
    }

    for (const oldTitle of entry.supersedes ?? []) {
      const oldId = idOf(oldTitle);
      await db.memoryLink.create({
        data: { fromEntryId: entryId, toEntryId: oldId, kind: MemoryLinkKind.SUPERSEDES },
      });
      if (replacedBy.get(oldTitle) !== entry) continue;

      // An agent's replacement lands when I accept it, not when it was written.
      await db.memoryRevision.create({
        data: {
          entryId: oldId,
          eventId: reviewed ? null : eventId,
          action: MemoryRevisionAction.SUPERSEDED,
          author: reviewed ? USER : entry.author,
          snapshot: snapshot(seedsByTitle.get(oldTitle)!, SUPERSEDED),
          createdAt: dayAt(entry.date, reviewed ? 17 : 10),
        },
      });
    }

    for (const label of wikiLinks(entry.body)) {
      await db.memoryLink.create({
        data: {
          fromEntryId: entryId,
          toEntryId: idOf(label),
          kind: MemoryLinkKind.RELATES_TO,
          label,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production.');
  }

  // Global memory has no domain to cascade from, so clear it first. Everything
  // else cascades from Domain.
  await db.memoryEntry.deleteMany();
  await db.memoryEvent.deleteMany();
  await db.domain.deleteMany();

  await seedMemory(GLOBAL_ENTRIES, [], {
    domainId: null,
    clusterIds: new Map(),
    nodeIds: new Map(),
  });

  for (const [domainIndex, domainSeed] of DOMAINS.entries()) {
    const domain = await db.domain.create({
      data: {
        slug: domainSeed.slug,
        title: domainSeed.title,
        themeHue: domainSeed.themeHue,
        position: domainIndex,
      },
    });

    // `clusterSlug:title` -> node id, for wiring focus, journals and completion.
    const nodeIds = new Map<string, string>();
    const clusterIds = new Map<string, string>();
    // Node titles are unique enough across a domain for [[wiki links]].
    const nodeIdsByTitle = new Map<string, string>();

    for (const [clusterIndex, clusterSeed] of domainSeed.clusters.entries()) {
      const cluster = await db.cluster.create({
        data: {
          domainId: domain.id,
          slug: clusterSeed.slug,
          title: clusterSeed.title,
          position: clusterIndex,
        },
      });
      clusterIds.set(clusterSeed.slug, cluster.id);

      // Position runs within a priority tier, matching the card board.
      const tierCounters: Record<Priority, number> = {
        [Priority.NOW]: 0,
        [Priority.NEXT]: 0,
        [Priority.SOMEDAY]: 0,
      };

      for (const spec of clusterSeed.nodes) {
        const { title, priority, kind } = parseNodeSpec(spec);
        const detail = domainSeed.details[`${clusterSeed.slug}:${title}`];

        const node = await db.node.create({
          data: {
            clusterId: cluster.id,
            kind,
            title,
            priority,
            position: tierCounters[priority]++,
            ...(detail?.description ? { description: detail.description } : {}),
            ...(detail?.notes
              ? {
                  notes: {
                    create: detail.notes.map((note) => ({
                      body: note.text,
                      author: USER,
                      occurredAt: dayAt(note.date, 18),
                    })),
                  },
                }
              : {}),
          },
        });

        nodeIds.set(`${clusterSeed.slug}:${title}`, node.id);
        nodeIdsByTitle.set(title, node.id);
      }
    }

    await seedMemory(domainSeed.entries, domainSeed.events, {
      domainId: domain.id,
      clusterIds,
      nodeIds,
    });

    // Checked-off work, which backs the "recently closed" list.
    for (const key of COMPLETED[domainSeed.slug] ?? []) {
      const nodeId = nodeIds.get(key);
      if (!nodeId) throw new Error(`Unknown completed node "${key}" in ${domainSeed.slug}`);
      await db.node.update({
        where: { id: nodeId },
        data: { completedAt: dayAt('2026-09-09', 14) },
      });
    }

    // The focus block.
    const focusKeys = FOCUS[domainSeed.slug] ?? [];
    for (const [position, key] of focusKeys.entries()) {
      const nodeId = nodeIds.get(key);
      if (!nodeId) throw new Error(`Unknown focus node "${key}" in ${domainSeed.slug}`);
      await db.focusItem.create({
        data: { domainId: domain.id, nodeId, position },
      });
    }

    // Journal entries, with their [[wiki links]] resolved to real rows.
    for (const [iso, body] of Object.entries(domainSeed.journal)) {
      const clusterLinks: { clusterId: string; label: string }[] = [];
      const nodeLinks: { nodeId: string; label: string }[] = [];

      for (const label of wikiLinks(body)) {
        const nodeId = nodeIdsByTitle.get(label);
        if (nodeId) {
          nodeLinks.push({ nodeId, label });
          continue;
        }
        const clusterId = clusterIds.get(slugify(label));
        if (clusterId) clusterLinks.push({ clusterId, label });
      }

      await db.journalEntry.create({
        data: {
          domainId: domain.id,
          entryDate: day(iso),
          body,
          ...(nodeLinks.length ? { nodeLinks: { create: nodeLinks } } : {}),
          ...(clusterLinks.length ? { clusterLinks: { create: clusterLinks } } : {}),
        },
      });
    }

    // Unfiled captures.
    for (const [index, text] of domainSeed.inbox.entries()) {
      await db.inboxItem.create({
        data: {
          domainId: domain.id,
          text,
          capturedAt: dayAt('2026-09-09', 8 + index),
        },
      });
    }
  }

  const counts = {
    domains: await db.domain.count(),
    clusters: await db.cluster.count(),
    nodes: await db.node.count(),
    memoryEntries: await db.memoryEntry.count(),
    memoryEvents: await db.memoryEvent.count(),
    memoryRevisions: await db.memoryRevision.count(),
    memoryLinks: await db.memoryLink.count(),
    notes: await db.note.count(),
    focus: await db.focusItem.count(),
    journal: await db.journalEntry.count(),
    inbox: await db.inboxItem.count(),
  };
  console.log('Seeded:', counts);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void db.$disconnect());
