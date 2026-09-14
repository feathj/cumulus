'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import MuiLink from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { useDomainPalette } from '@/components/domain-theme';
import { Markdown } from '@/components/markdown';
import { withAlpha } from '@/lib/color';
import { formatDay, plural } from '@/lib/format';
import { authorLabel, memoryTypeStyle } from '@/lib/memory-style';
import { attention, neutral } from '@/lib/palette';
import type { NodeDetail } from '@/server/services/nodes';
import { useTRPC } from '@/trpc/client';

import { useNodeSelection } from './use-node-selection';

const PRIORITY_LABELS = { NOW: 'Now', NEXT: 'Next', SOMEDAY: 'Someday' } as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The card detail panel, open whenever the URL has `?node=`. Escape closes it. */
export function NodeDrawer() {
  const { selectedId, clear } = useNodeSelection();

  useEffect(() => {
    if (!selectedId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clear();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId, clear]);

  if (!selectedId) return null;

  return (
    <Box
      component="aside"
      aria-label="Card details"
      sx={{
        width: 380,
        flex: '0 0 380px',
        maxWidth: '45%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        borderLeft: 1,
        borderColor: 'divider',
        bgcolor: neutral.surface,
        boxShadow: `-18px 0 44px ${withAlpha(neutral.rail, 0.55)}`,
        '@keyframes cumulusDrawerIn': {
          from: { opacity: 0, transform: 'translateX(12px)' },
          to: { opacity: 1, transform: 'none' },
        },
        animation: 'cumulusDrawerIn 200ms ease both',
      }}
    >
      <NodeDetailPanel key={selectedId} id={selectedId} onClose={clear} />
    </Box>
  );
}

function NodeDetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const trpc = useTRPC();
  const { data: node, isPending, isError } = useQuery(trpc.node.detail.queryOptions({ id }));

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1.5, pt: 1.25 }}>
        <ButtonBase
          aria-label="Close card details"
          onClick={onClose}
          sx={{
            color: 'text.secondary',
            fontSize: 16,
            lineHeight: 1,
            p: 0.75,
            borderRadius: 0.5,
            '&:hover': { color: neutral.text },
          }}
        >
          ✕
        </ButtonBase>
      </Box>
      {isPending ? (
        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <CircularProgress size={20} aria-label="Loading card" />
        </Box>
      ) : isError ? (
        <Typography sx={{ px: 2.5, color: 'text.secondary' }}>
          This card couldn’t be loaded.
        </Typography>
      ) : (
        <NodeDetailBody node={node} />
      )}
    </>
  );
}

function NodeDetailBody({ node }: { node: NodeDetail }) {
  const palette = useDomainPalette();
  const memoryHref = `/${node.domain.slug}/${node.cluster.slug}/memory`;
  const pills = [
    PRIORITY_LABELS[node.priority],
    ...(node.completedAt ? [`done ${formatDay(node.completedAt)}`] : []),
    ...(node.inFocus ? ['in focus block'] : []),
  ];

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2.5, pb: 3 }}>
      <Typography
        sx={{
          fontSize: 9.5,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: palette.accent,
        }}
      >
        {node.kind === 'TOPIC' ? 'Topic' : 'Task'}
      </Typography>
      <Typography component="h2" sx={{ fontSize: 17, fontWeight: 500, lineHeight: 1.4, mt: 1 }}>
        {node.title}
      </Typography>
      <Typography
        sx={{ fontSize: 10.5, letterSpacing: '0.04em', color: 'text.secondary', mt: 0.75 }}
      >
        {node.domain.title} / {node.cluster.title} · added {formatDay(node.createdAt)}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1.75 }}>
        {pills.map((pill) => (
          <Typography
            key={pill}
            component="span"
            sx={{
              fontSize: 10.5,
              letterSpacing: '0.05em',
              border: `1px solid ${palette.border}`,
              bgcolor: palette.soft,
              color: palette.accent,
              borderRadius: 0.75,
              px: 1,
              py: 0.35,
            }}
          >
            {pill}
          </Typography>
        ))}
      </Box>

      <Section title="Description">
        {node.description ? (
          <Markdown size="compact">{node.description}</Markdown>
        ) : (
          <Quiet>No description.</Quiet>
        )}
      </Section>

      {node.attachments.length > 0 && (
        <Section title={plural(node.attachments.length, 'attachment')}>
          <Box
            component="ul"
            sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
          >
            {node.attachments.map((attachment) => {
              const details = [
                attachment.mimeType,
                attachment.byteSize ? formatBytes(attachment.byteSize) : null,
              ].filter((detail): detail is string => Boolean(detail));
              return (
                <li key={attachment.id}>
                  {attachment.url ? (
                    <MuiLink
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ fontSize: 13, overflowWrap: 'anywhere' }}
                    >
                      {attachment.name}
                    </MuiLink>
                  ) : (
                    <Typography sx={{ fontSize: 13 }}>{attachment.name}</Typography>
                  )}
                  {details.length > 0 && (
                    <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.25 }}>
                      {details.join(' · ')}
                    </Typography>
                  )}
                </li>
              );
            })}
          </Box>
        </Section>
      )}

      <Section
        title="Memory"
        action={
          <MuiLink component={Link} href={memoryHref} sx={{ fontSize: 10.5 }}>
            cluster memory →
          </MuiLink>
        }
      >
        {node.memory.length === 0 ? (
          <Quiet>Nothing kept about this card yet.</Quiet>
        ) : (
          <Box
            component="ul"
            sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}
          >
            {node.memory.map((entry) => {
              const style = memoryTypeStyle(entry.type, palette.hue);
              const pending = entry.status === 'PENDING';
              return (
                <li key={entry.id}>
                  <Box
                    component={Link}
                    href={`${memoryHref}#entry-${entry.id}`}
                    sx={{
                      display: 'block',
                      color: 'inherit',
                      textDecoration: 'none',
                      borderLeft: `2px solid ${style.color}`,
                      pl: 1.5,
                      py: 0.25,
                      '&:hover': { bgcolor: withAlpha(neutral.raised, 0.7) },
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: 9,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: pending ? attention : style.color,
                      }}
                    >
                      {style.label}
                      {pending ? ' · awaiting review' : ''}
                    </Typography>
                    <Typography sx={{ fontSize: 13.5, lineHeight: 1.4, mt: 0.25 }}>
                      {entry.title}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>
                      {entry.description}
                    </Typography>
                  </Box>
                </li>
              );
            })}
          </Box>
        )}
      </Section>

      <Section title="Thread">
        {node.notes.length === 0 ? (
          <Quiet>No notes yet.</Quiet>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {node.notes.map((note) => (
              <Box key={note.id} sx={{ borderLeft: `2px solid ${palette.border}`, pl: 1.5, py: 0.25 }}>
                <Typography sx={{ fontSize: 9.5, letterSpacing: '0.05em', color: 'text.secondary' }}>
                  {formatDay(note.occurredAt)} · {authorLabel(note.author)}
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Markdown size="compact">{note.body}</Markdown>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Section>
    </Box>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Box component="section" sx={{ mt: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
        <Typography
          component="h3"
          sx={{
            fontSize: 9.5,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            color: 'text.secondary',
          }}
        >
          {title}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {action}
      </Box>
      {children}
    </Box>
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{children}</Typography>;
}
