'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import type { MemoryEntryStatus } from '@prisma/client';

import { useDomainPalette } from '@/components/domain-theme';
import type { WikiLinkResolver } from '@/components/markdown';
import { oklch, withAlpha } from '@/lib/color';
import { formatDay, plural } from '@/lib/format';
import { authorLabel, memoryTypeStyle } from '@/lib/memory-style';
import { neutral } from '@/lib/palette';
import type { EntryLink, MemoryEntryView } from '@/server/services/memory';

import {
  Aside,
  EmptyNote,
  Expandable,
  JumpChip,
  metaTextSx,
  overlineSx,
  recallHeat,
  SectionHeading,
  Spine,
  SpineRow,
  TypeMarker,
} from './memory-parts';

/** Beyond this many links in one group, the rest are summarised. */
const MAX_CHIPS = 8;

const STATUS_LABELS: Record<MemoryEntryStatus, string> = {
  PENDING: 'Pending',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
  SUPERSEDED: 'Superseded',
  ARCHIVED: 'Archived',
};

export interface KnowledgePaneProps {
  pending: MemoryEntryView[];
  kept: MemoryEntryView[];
  writeUps: MemoryEntryView[];
  history: MemoryEntryView[];
  historyOpen: boolean;
  onToggleHistory: () => void;
  filtered: boolean;
  highlightId: string | null;
  onOpenEntry: (id: string) => void;
  onOpenEvent: (id: string) => void;
  resolveWikiLink: WikiLinkResolver;
}

/** What the cluster currently knows, with proposals above and replaced knowledge tucked below. */
export function KnowledgePane(props: KnowledgePaneProps) {
  const { pending, kept, writeUps, history } = props;

  if (!pending.length && !kept.length && !writeUps.length && !history.length) {
    return (
      <EmptyNote>
        {props.filtered
          ? 'Nothing matches that filter.'
          : 'No memory here yet. As agents work this cluster, decisions and facts land here for review.'}
      </EmptyNote>
    );
  }

  return (
    <Box sx={{ maxWidth: 1040, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 4, pt: 1 }}>
      {pending.length > 0 && <PendingSection entries={pending} {...props} />}

      {kept.length > 0 && (
        <Box component="section">
          <SectionHeading title="Kept" meta={plural(kept.length, 'entry', 'entries')} />
          <Spine>
            {kept.map((entry) => (
              <EntryRow key={entry.id} entry={entry} writeUp={false} {...props} />
            ))}
          </Spine>
        </Box>
      )}

      {writeUps.length > 0 && (
        <Box component="section">
          <SectionHeading
            title="Write-ups"
            meta={`${plural(writeUps.length, 'maintained overview')} · read in full on demand`}
          />
          <Spine>
            {writeUps.map((entry) => (
              <EntryRow key={entry.id} entry={entry} writeUp {...props} />
            ))}
          </Spine>
        </Box>
      )}

      {history.length > 0 && <HistorySection entries={history} {...props} />}
    </Box>
  );
}

function EntryRow({
  entry,
  writeUp,
  highlightId,
  onOpenEntry,
  onOpenEvent,
  resolveWikiLink,
}: KnowledgePaneProps & { entry: MemoryEntryView; writeUp: boolean }) {
  const palette = useDomainPalette();
  const style = memoryTypeStyle(entry.type, palette.hue);
  const heat = recallHeat(entry.recallCount);

  return (
    <SpineRow
      id={`entry-${entry.id}`}
      highlighted={highlightId === entry.id}
      marker={<TypeMarker type={entry.type} heat={heat} />}
      meta={
        <>
          <Typography sx={metaTextSx}>{formatDay(entry.updatedAt)}</Typography>
          <Typography sx={{ ...overlineSx, color: style.color }}>{style.label}</Typography>
          <Typography sx={{ ...metaTextSx, color: heat > 0.4 ? palette.accent : neutral.muted }}>
            {entry.recallCount ? `pulled ${entry.recallCount}×` : 'never pulled'}
          </Typography>
          <Typography sx={metaTextSx}>{authorLabel(entry.author)}</Typography>
        </>
      }
    >
      <Typography
        component="h4"
        sx={{ fontSize: 16, fontWeight: 500, lineHeight: 1.34, color: neutral.text }}
      >
        {entry.title}
      </Typography>
      {entry.node && (
        <Typography sx={{ ...metaTextSx, mt: 0.25 }}>on card · {entry.node.title}</Typography>
      )}
      <Typography sx={{ mt: 0.75, fontSize: 13.5, lineHeight: 1.5, color: neutral.muted, maxWidth: '64ch' }}>
        {entry.description}
      </Typography>

      <Box sx={{ mt: 1.25, maxWidth: '68ch' }}>
        {writeUp ? (
          <Expandable
            source={entry.body}
            resolveWikiLink={resolveWikiLink}
            threshold={0}
            clippedHeight={0}
            openLabel={`Read the write-up · ${plural(wordCount(entry.body), 'word')}`}
            closeLabel="Close the write-up"
          />
        ) : (
          <Expandable source={entry.body} resolveWikiLink={resolveWikiLink} />
        )}
      </Box>

      {entry.rationale && (
        <Aside label="why" resolveWikiLink={resolveWikiLink}>
          {entry.rationale}
        </Aside>
      )}
      {entry.alternatives && (
        <Aside label="instead of" resolveWikiLink={resolveWikiLink}>
          {entry.alternatives}
        </Aside>
      )}
      {entry.howToApply && (
        <Aside label="how to apply" resolveWikiLink={resolveWikiLink}>
          {entry.howToApply}
        </Aside>
      )}

      {entry.tags.length > 0 && (
        <Typography sx={{ ...metaTextSx, mt: 1.25 }}>
          {entry.tags.map((tag) => `#${tag}`).join('  ')}
        </Typography>
      )}

      <Relations entry={entry} onOpenEntry={onOpenEntry} onOpenEvent={onOpenEvent} />
    </SpineRow>
  );
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function Relations({
  entry,
  onOpenEntry,
  onOpenEvent,
}: {
  entry: MemoryEntryView;
  onOpenEntry: (id: string) => void;
  onOpenEvent: (id: string) => void;
}) {
  const toJump = (link: EntryLink) => ({
    key: `${link.kind}-${link.entryId}`,
    text: link.title,
    onClick: () => onOpenEntry(link.entryId),
  });
  const supersedes = (link: EntryLink) => link.kind === 'SUPERSEDES';
  const relates = (link: EntryLink) => link.kind === 'RELATES_TO';

  const groups = [
    { label: 'replaces', links: entry.linksOut.filter(supersedes).map(toJump) },
    { label: 'replaced by', links: entry.linksIn.filter(supersedes).map(toJump) },
    { label: 'links to', links: entry.linksOut.filter(relates).map(toJump) },
    { label: 'linked from', links: entry.linksIn.filter(relates).map(toJump) },
    {
      label: 'sources',
      links: entry.references.map((reference) => ({
        key: `event-${reference.eventId}`,
        text: `${reference.title} · ${formatDay(reference.occurredAt)}`,
        onClick: () => onOpenEvent(reference.eventId),
      })),
    },
  ].filter((group) => group.links.length > 0);

  if (!groups.length) return null;

  return (
    <Box sx={{ mt: 1.6, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      {groups.map((group) => (
        <Box key={group.label} sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
          <Typography
            component="span"
            sx={{ ...overlineSx, fontSize: 9, color: neutral.muted, minWidth: 76 }}
          >
            {group.label}
          </Typography>
          {group.links.slice(0, MAX_CHIPS).map((link) => (
            <JumpChip key={link.key} onClick={link.onClick}>
              {link.text}
            </JumpChip>
          ))}
          {group.links.length > MAX_CHIPS && (
            <Typography component="span" sx={metaTextSx}>
              +{group.links.length - MAX_CHIPS} more
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

function PendingSection({
  entries,
  highlightId,
}: KnowledgePaneProps & { entries: MemoryEntryView[] }) {
  const palette = useDomainPalette();
  return (
    <Box
      component="section"
      aria-label="Awaiting review"
      sx={{
        border: `1px dashed ${palette.border}`,
        bgcolor: oklch(0.176, 0.018, 265),
        borderRadius: 2,
        px: 2.1,
        py: 1.9,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap', mb: 1.5 }}>
        <Typography component="h3" sx={{ ...overlineSx, fontSize: 10, color: palette.accent }}>
          {entries.length === 1 ? '1 memory awaiting review' : `${entries.length} memories awaiting review`}
        </Typography>
        <Typography sx={metaTextSx}>keep and discard arrive with the write path</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.1 }}>
        {entries.map((entry) => {
          const style = memoryTypeStyle(entry.type, palette.hue);
          return (
            <Box
              key={entry.id}
              id={`entry-${entry.id}`}
              sx={{
                border: `1px solid ${oklch(0.27, 0.014, 265)}`,
                bgcolor: highlightId === entry.id ? withAlpha(palette.soft, 0.55) : oklch(0.155, 0.012, 265),
                borderRadius: 1.5,
                px: 1.75,
                py: 1.5,
                scrollMarginTop: 24,
                transition: 'background-color 900ms ease',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, mb: 0.75, flexWrap: 'wrap' }}>
                <Typography
                  component="span"
                  sx={{
                    ...overlineSx,
                    fontSize: 8.5,
                    color: style.color,
                    border: `1px solid ${withAlpha(style.color, 0.5)}`,
                    borderRadius: 0.5,
                    px: 1,
                    py: 0.25,
                  }}
                >
                  {style.label}
                </Typography>
                <Typography component="span" sx={metaTextSx}>
                  {formatDay(entry.createdAt)} · {authorLabel(entry.author)}
                </Typography>
                {entry.node && (
                  <Typography component="span" sx={metaTextSx}>
                    · on card {entry.node.title}
                  </Typography>
                )}
              </Box>
              <Typography sx={{ fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>{entry.title}</Typography>
              <Typography sx={{ fontSize: 13, lineHeight: 1.5, mt: 0.5, color: neutral.muted }}>
                {entry.description}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function HistorySection({
  entries,
  historyOpen,
  onToggleHistory,
  highlightId,
  onOpenEntry,
}: KnowledgePaneProps & { entries: MemoryEntryView[] }) {
  const palette = useDomainPalette();
  return (
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.25 }}>
      <ButtonBase
        onClick={onToggleHistory}
        aria-expanded={historyOpen}
        sx={{
          ...overlineSx,
          border: `1px solid ${neutral.line}`,
          borderRadius: 0.75,
          px: 1.75,
          py: 0.75,
          color: neutral.muted,
          '&:hover': { color: neutral.text, borderColor: neutral.lineStrong },
        }}
      >
        {historyOpen ? 'Hide' : 'Show'} replaced and archived · {entries.length}
      </ButtonBase>
      {historyOpen && (
        <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {entries.map((entry) => {
            const style = memoryTypeStyle(entry.type, palette.hue);
            const replacedBy = entry.linksIn.filter((link) => link.kind === 'SUPERSEDES');
            return (
              <Box
                key={entry.id}
                id={`entry-${entry.id}`}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  flexWrap: 'wrap',
                  border: `1px solid ${oklch(0.227, 0.01, 265)}`,
                  bgcolor: highlightId === entry.id ? withAlpha(palette.soft, 0.55) : oklch(0.142, 0.008, 265),
                  borderRadius: 1,
                  px: 1.75,
                  py: 1.25,
                  scrollMarginTop: 24,
                  transition: 'background-color 900ms ease',
                }}
              >
                <Typography component="span" sx={{ ...overlineSx, fontSize: 8.5, color: neutral.muted }}>
                  {STATUS_LABELS[entry.status]}
                </Typography>
                <Typography component="span" sx={{ ...overlineSx, fontSize: 8.5, color: style.color }}>
                  {style.label}
                </Typography>
                <Typography
                  component="span"
                  sx={{ flex: 1, minWidth: 180, fontSize: 13.5, lineHeight: 1.35, color: oklch(0.7, 0.008, 265) }}
                >
                  {entry.title}
                </Typography>
                {replacedBy.map((link) => (
                  <JumpChip key={link.entryId} onClick={() => onOpenEntry(link.entryId)}>
                    replaced by {link.title}
                  </JumpChip>
                ))}
                <Typography component="span" sx={{ ...metaTextSx, whiteSpace: 'nowrap' }}>
                  {formatDay(entry.updatedAt)}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
