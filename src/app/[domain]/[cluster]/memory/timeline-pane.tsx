'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { MemoryRevisionAction } from '@prisma/client';
import { Fragment, useMemo } from 'react';

import { useDomainPalette } from '@/components/domain-theme';
import type { WikiLinkResolver } from '@/components/markdown';
import { dayKey, formatDay, formatTime } from '@/lib/format';
import { actionLabel, authorLabel, memoryTypeStyle } from '@/lib/memory-style';
import { neutral } from '@/lib/palette';
import type { ClusterMemory, MemoryChange, MemoryEventView } from '@/server/services/memory';

import {
  EmptyNote,
  Expandable,
  JumpChip,
  metaTextSx,
  overlineSx,
  Spine,
  SpineHeading,
  SpineRow,
} from './memory-parts';

type TimelineItem =
  | { kind: 'event'; at: Date; event: MemoryEventView }
  | { kind: 'change'; at: Date; change: MemoryChange };

export interface TimelinePaneProps {
  memory: ClusterMemory;
  query: string;
  highlightId: string | null;
  onOpenEntry: (id: string) => void;
  resolveWikiLink: WikiLinkResolver;
}

/** What happened, newest first: events with the knowledge they changed, plus reviews made outside any event. */
export function TimelinePane({ memory, query, highlightId, onOpenEntry, resolveWikiLink }: TimelinePaneProps) {
  const days = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (text: string) => !needle || text.toLowerCase().includes(needle);

    const items: TimelineItem[] = [
      ...memory.events
        .filter((event) => matches(`${event.title}\n${event.body}\n${event.tags.join(' ')}`))
        .map((event) => ({ kind: 'event' as const, at: event.occurredAt, event })),
      ...memory.looseChanges
        .filter((change) => matches(change.entryTitle))
        .map((change) => ({ kind: 'change' as const, at: change.createdAt, change })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());

    const grouped: { key: string; date: Date; items: TimelineItem[] }[] = [];
    for (const item of items) {
      const key = dayKey(item.at);
      const last = grouped.at(-1);
      if (last?.key === key) last.items.push(item);
      else grouped.push({ key, date: item.at, items: [item] });
    }
    return grouped;
  }, [memory, query]);

  if (!days.length) {
    return (
      <EmptyNote>
        {query.trim() ? 'Nothing on the timeline matches that filter.' : 'Nothing has happened here yet.'}
      </EmptyNote>
    );
  }

  return (
    <Box sx={{ maxWidth: 1040, mx: 'auto' }}>
      <Spine>
        {days.map((day) => (
          <Fragment key={day.key}>
            <SpineHeading>{formatDay(day.date)}</SpineHeading>
            {day.items.map((item) =>
              item.kind === 'event' ? (
                <EventRow
                  key={item.event.id}
                  event={item.event}
                  highlighted={highlightId === item.event.id}
                  onOpenEntry={onOpenEntry}
                  resolveWikiLink={resolveWikiLink}
                />
              ) : (
                <ChangeRow key={item.change.revisionId} change={item.change} onOpenEntry={onOpenEntry} />
              ),
            )}
          </Fragment>
        ))}
      </Spine>
    </Box>
  );
}

function EventRow({
  event,
  highlighted,
  onOpenEntry,
  resolveWikiLink,
}: {
  event: MemoryEventView;
  highlighted: boolean;
  onOpenEntry: (id: string) => void;
  resolveWikiLink: WikiLinkResolver;
}) {
  const palette = useDomainPalette();
  const session = event.kind === 'SESSION';

  return (
    <SpineRow
      id={`event-${event.id}`}
      highlighted={highlighted}
      marker={
        <Box
          sx={{
            width: 11,
            height: 11,
            borderRadius: session ? '2px' : '50%',
            transform: session ? 'rotate(45deg)' : 'none',
            border: `1.5px solid ${session ? palette.accent : neutral.textSoft}`,
            bgcolor: session ? neutral.canvas : neutral.textSoft,
          }}
        />
      }
      meta={
        <>
          <Typography sx={metaTextSx}>{formatTime(event.occurredAt)}</Typography>
          <Typography sx={{ ...overlineSx, color: session ? palette.accent : neutral.textSoft }}>
            {session ? 'Session' : 'Log'}
          </Typography>
          <Typography sx={metaTextSx}>{authorLabel(event.author, event.agent)}</Typography>
          {event.referenceCount > 0 && (
            <Typography sx={metaTextSx}>cited by {event.referenceCount}</Typography>
          )}
        </>
      }
    >
      <Typography component="h4" sx={{ fontSize: 15.5, fontWeight: 500, lineHeight: 1.35, color: neutral.text }}>
        {event.title}
      </Typography>
      {event.node && <Typography sx={{ ...metaTextSx, mt: 0.25 }}>on card · {event.node.title}</Typography>}
      {event.sourceRef && (
        <Typography
          sx={{
            mt: 0.5,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 11,
            color: neutral.muted,
            overflowWrap: 'anywhere',
          }}
        >
          {event.sourceRef}
        </Typography>
      )}
      {event.body && (
        <Box sx={{ mt: 1, maxWidth: '68ch' }}>
          <Expandable
            source={event.body}
            resolveWikiLink={resolveWikiLink}
            threshold={320}
            clippedHeight={96}
            size="compact"
          />
        </Box>
      )}
      <ChangeGroups changes={event.changes} onOpenEntry={onOpenEntry} />
    </SpineRow>
  );
}

function ChangeGroups({
  changes,
  onOpenEntry,
}: {
  changes: MemoryChange[];
  onOpenEntry: (id: string) => void;
}) {
  const { hue } = useDomainPalette();
  if (!changes.length) return null;

  const groups = new Map<MemoryRevisionAction, MemoryChange[]>();
  for (const change of changes) groups.set(change.action, [...(groups.get(change.action) ?? []), change]);

  return (
    <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {[...groups.entries()].map(([action, list]) => (
        <Box key={action} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
          <Typography component="span" sx={{ ...overlineSx, fontSize: 9, color: neutral.muted, minWidth: 76 }}>
            {actionLabel(action)}
          </Typography>
          {list.map((change) => (
            <JumpChip
              key={change.revisionId}
              onClick={() => onOpenEntry(change.entryId)}
              dotColor={memoryTypeStyle(change.entryType, hue).color}
            >
              {change.entryTitle}
            </JumpChip>
          ))}
        </Box>
      ))}
    </Box>
  );
}

function ChangeRow({ change, onOpenEntry }: { change: MemoryChange; onOpenEntry: (id: string) => void }) {
  const { hue } = useDomainPalette();
  return (
    <SpineRow
      id={`change-${change.revisionId}`}
      dense
      highlighted={false}
      marker={<Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: neutral.lineStrong }} />}
      meta={
        <>
          <Typography sx={metaTextSx}>{formatTime(change.createdAt)}</Typography>
          <Typography sx={{ ...overlineSx, fontSize: 9, color: neutral.muted }}>
            {actionLabel(change.action)}
          </Typography>
        </>
      }
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <JumpChip
          onClick={() => onOpenEntry(change.entryId)}
          dotColor={memoryTypeStyle(change.entryType, hue).color}
        >
          {change.entryTitle}
        </JumpChip>
        <Typography component="span" sx={metaTextSx}>
          by {authorLabel(change.author)}
        </Typography>
      </Box>
    </SpineRow>
  );
}
