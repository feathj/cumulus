'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import type { MemoryEntryStatus, MemoryEntryType } from '@prisma/client';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDomainPalette } from '@/components/domain-theme';
import type { WikiLinkResolver } from '@/components/markdown';
import { SegmentGroup, segmentSx } from '@/components/segmented';
import { plural } from '@/lib/format';
import { memoryTypeStyle } from '@/lib/memory-style';
import { neutral } from '@/lib/palette';
import type { MemoryEntryView } from '@/server/services/memory';
import { useTRPC } from '@/trpc/client';

import { KnowledgePane } from './knowledge-pane';
import { TimelinePane } from './timeline-pane';

type Tab = 'knowledge' | 'timeline';

interface Target {
  kind: 'entry' | 'event';
  id: string;
}

const TYPE_ORDER: MemoryEntryType[] = [
  'DECISION',
  'FACT',
  'PREFERENCE',
  'PROCEDURE',
  'REFERENCE',
  'QUESTION',
  'SYNTHESIS',
];

const HISTORY_STATUSES: ReadonlySet<MemoryEntryStatus> = new Set(['SUPERSEDED', 'ARCHIVED', 'REJECTED']);

/** How long a jumped-to row stays highlighted. */
const HIGHLIGHT_MS = 2400;

/**
 * A cluster's memory in two views over the same data: Knowledge is what's
 * believed now, Timeline is how it came to be. Links between them — an
 * entry's sources, an event's changes, `[[wiki links]]` in either — jump
 * across and flash the row they land on.
 */
export function MemoryView({ domainSlug, clusterSlug }: { domainSlug: string; clusterSlug: string }) {
  const trpc = useTRPC();
  const palette = useDomainPalette();
  const { data: memory } = useSuspenseQuery(
    trpc.memory.cluster.queryOptions({ domainSlug, clusterSlug }),
  );

  const [tab, setTab] = useState<Tab>('knowledge');
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<MemoryEntryType | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);

  const entriesById = useMemo(() => new Map(memory.entries.map((e) => [e.id, e])), [memory.entries]);
  const entryIdsByTitle = useMemo(
    () => new Map(memory.entries.map((e) => [e.title, e.id])),
    [memory.entries],
  );
  const eventIdsByTitle = useMemo(
    () => new Map(memory.events.map((e) => [e.title, e.id])),
    [memory.events],
  );

  const openEntry = useCallback(
    (id: string) => {
      const entry = entriesById.get(id);
      if (!entry) return;
      if (HISTORY_STATUSES.has(entry.status)) setHistoryOpen(true);
      setQuery('');
      setTypeFilter(null);
      setTab('knowledge');
      setTarget({ kind: 'entry', id });
    },
    [entriesById],
  );

  const openEvent = useCallback((id: string) => {
    setQuery('');
    setTab('timeline');
    setTarget({ kind: 'event', id });
  }, []);

  const resolveWikiLink = useCallback<WikiLinkResolver>(
    (title) => {
      const entryId = entryIdsByTitle.get(title);
      if (entryId) return () => openEntry(entryId);
      const eventId = eventIdsByTitle.get(title);
      if (eventId) return () => openEvent(eventId);
      return null;
    },
    [entryIdsByTitle, eventIdsByTitle, openEntry, openEvent],
  );

  // Follow #entry-<id> and #event-<id> links, such as those from the cloud's
  // memory peek and the card drawer. The hash lives outside React, so read it
  // after the first paint and whenever it changes.
  useEffect(() => {
    const follow = () => {
      const match = /^#(entry|event)-(.+)$/.exec(window.location.hash);
      const id = match?.[2];
      if (!id) return;
      if (match[1] === 'event') openEvent(id);
      else openEntry(id);
    };
    const frame = requestAnimationFrame(follow);
    window.addEventListener('hashchange', follow);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', follow);
    };
  }, [openEntry, openEvent]);

  // Bring the target into view once it has rendered, then let the highlight fade.
  useEffect(() => {
    if (!target) return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(`${target.kind}-${target.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    const timeout = window.setTimeout(() => setTarget(null), HIGHLIGHT_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [target]);

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (entry: MemoryEntryView) =>
      (!typeFilter || entry.type === typeFilter) &&
      (!needle ||
        `${entry.title}\n${entry.description}\n${entry.body}\n${entry.tags.join(' ')}`
          .toLowerCase()
          .includes(needle));

    const visible = memory.entries.filter(matches);
    return {
      pending: visible.filter((entry) => entry.status === 'PENDING'),
      kept: visible.filter((entry) => entry.status === 'ACTIVE' && entry.type !== 'SYNTHESIS'),
      writeUps: visible.filter((entry) => entry.status === 'ACTIVE' && entry.type === 'SYNTHESIS'),
      history: visible.filter((entry) => HISTORY_STATUSES.has(entry.status)),
    };
  }, [memory.entries, query, typeFilter]);

  const stats = useMemo(() => {
    const active = memory.entries.filter((entry) => entry.status === 'ACTIVE');
    const typeCounts = TYPE_ORDER.map((type) => ({
      type,
      count: active.filter((entry) => entry.type === type).length,
    })).filter(({ count }) => count > 0);
    return {
      active: active.length,
      pulls: active.reduce((total, entry) => total + entry.recallCount, 0),
      pending: memory.entries.filter((entry) => entry.status === 'PENDING').length,
      typeCounts,
    };
  }, [memory.entries]);

  const meta = [
    `${stats.active} kept`,
    plural(stats.pulls, 'pull'),
    ...(stats.pending ? [`${stats.pending} awaiting review`] : []),
    plural(memory.events.length, 'event'),
  ].join(' · ');

  return (
    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap',
          px: 2.75,
          pt: 1.75,
          pb: 1.25,
        }}
      >
        <SegmentGroup label="Memory views">
          {(['knowledge', 'timeline'] as const).map((value) => (
            <ButtonBase
              key={value}
              onClick={() => setTab(value)}
              aria-pressed={tab === value}
              sx={segmentSx(tab === value, palette)}
            >
              {value === 'knowledge' ? 'Knowledge' : 'Timeline'}
            </ButtonBase>
          ))}
        </SegmentGroup>
        <Typography sx={{ fontSize: 10, letterSpacing: '0.06em', color: 'text.secondary' }}>{meta}</Typography>
        <Box sx={{ flex: 1 }} />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flex: '0 1 340px',
            minWidth: 220,
            height: 36,
            pl: 1.5,
            pr: 1,
            border: `1px solid ${neutral.lineStrong}`,
            bgcolor: neutral.raised,
            borderRadius: 1.5,
          }}
        >
          <InputBase
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tab === 'knowledge' ? 'Filter what this cluster knows…' : 'Filter the timeline…'}
            inputProps={{ 'aria-label': 'Filter memory' }}
            sx={{ flex: 1, fontSize: 13.5, color: neutral.text }}
          />
          {query && (
            <ButtonBase
              aria-label="Clear filter"
              onClick={() => setQuery('')}
              sx={{ color: 'text.secondary', fontSize: 12, p: 0.5, '&:hover': { color: neutral.text } }}
            >
              ✕
            </ButtonBase>
          )}
        </Box>
      </Box>

      {tab === 'knowledge' && stats.typeCounts.length > 0 && (
        <Box sx={{ flex: '0 0 auto', display: 'flex', gap: 0.6, flexWrap: 'wrap', px: 2.75, pb: 1.5 }}>
          {stats.typeCounts.map(({ type, count }) => {
            const style = memoryTypeStyle(type, palette.hue);
            const active = typeFilter === type;
            return (
              <ButtonBase
                key={type}
                onClick={() => setTypeFilter(active ? null : type)}
                aria-pressed={active}
                sx={{
                  display: 'flex',
                  gap: 0.75,
                  border: `1px solid ${active ? palette.border : neutral.line}`,
                  bgcolor: active ? palette.soft : 'transparent',
                  color: active ? palette.accent : neutral.muted,
                  borderRadius: 0.5,
                  px: 1.4,
                  py: 0.75,
                  fontSize: 9.5,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  '&:hover': { borderColor: palette.border },
                }}
              >
                <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: style.color }} />
                {style.label}
                <Box component="span" sx={{ opacity: 0.6 }}>
                  {count}
                </Box>
              </ButtonBase>
            );
          })}
        </Box>
      )}

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2.75, pb: 6 }}>
        {tab === 'knowledge' ? (
          <KnowledgePane
            {...sections}
            historyOpen={historyOpen}
            onToggleHistory={() => setHistoryOpen((open) => !open)}
            filtered={Boolean(query.trim() || typeFilter)}
            highlightId={target?.kind === 'entry' ? target.id : null}
            onOpenEntry={openEntry}
            onOpenEvent={openEvent}
            resolveWikiLink={resolveWikiLink}
          />
        ) : (
          <TimelinePane
            memory={memory}
            query={query}
            highlightId={target?.kind === 'event' ? target.id : null}
            onOpenEntry={openEntry}
            resolveWikiLink={resolveWikiLink}
          />
        )}
      </Box>
    </Box>
  );
}
