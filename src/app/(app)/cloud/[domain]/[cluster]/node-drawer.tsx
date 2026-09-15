'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import CircularProgress from '@mui/material/CircularProgress';
import MuiLink from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { ClusterPicker } from '@/components/cluster-picker';
import type { ClusterTarget } from '@/components/cluster-picker';
import { useDomainPalette } from '@/components/domain-theme';
import { Markdown } from '@/components/markdown';
import { useShowNotice } from '@/components/notice';
import type { ShowNotice } from '@/components/notice';
import { withAlpha } from '@/lib/color';
import { formatDay, plural } from '@/lib/format';
import { authorLabel, memoryTypeStyle } from '@/lib/memory-style';
import { attention, neutral } from '@/lib/palette';
import { clusterPath, todayPath } from '@/lib/routes';
import type { NodeDetail, TransferredCard } from '@/server/services/nodes';
import { useTRPC, useTRPCClient } from '@/trpc/client';

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
  const show = useShowNotice();

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
      {/* Notices go to the app's snackbar, so an Undo survives the drawer closing. */}
      <NodeDetailPanel key={selectedId} id={selectedId} onClose={clear} onNotice={show} />
    </Box>
  );
}

function NodeDetailPanel({ id, onClose, onNotice }: { id: string; onClose: () => void; onNotice: ShowNotice }) {
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
        <Typography sx={{ px: 2.5, color: 'text.secondary' }}>This card couldn’t be loaded.</Typography>
      ) : (
        <NodeDetailBody node={node} onNotice={onNotice} />
      )}
    </>
  );
}

/** Archive or restore, with Undo after archiving. Invalidates everything that counts or shows cards. */
function ArchiveControl({ node, onNotice }: { node: NodeDetail; onNotice: ShowNotice }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const palette = useDomainPalette();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.cluster.pathKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.domain.pathKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.node.detail.queryKey({ id: node.id }) });
  };
  const archive = useMutation(trpc.node.archive.mutationOptions({ onSettled: refresh }));
  const restore = useMutation(trpc.node.restore.mutationOptions({ onSettled: refresh }));
  const busy = archive.isPending || restore.isPending;

  if (node.archivedAt) {
    return (
      <Box
        sx={{
          flex: '1 1 100%',
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          flexWrap: 'wrap',
          border: `1px dashed ${palette.border}`,
          borderRadius: 1,
          px: 1.5,
          py: 1,
        }}
      >
        <Typography sx={{ flex: 1, minWidth: 160, fontSize: 12, lineHeight: 1.4, color: neutral.textSoft }}>
          Archived {formatDay(node.archivedAt)}. It isn’t on the board or in the cloud.
        </Typography>
        <Button
          size="small"
          variant="outlined"
          disabled={busy}
          onClick={() =>
            restore.mutate(
              { id: node.id },
              {
                onSuccess: () => onNotice('Card restored.'),
                onError: () => onNotice('That card couldn’t be restored.'),
              },
            )
          }
        >
          Restore
        </Button>
      </Box>
    );
  }

  return (
    <Button
      size="small"
      variant="outlined"
      color="inherit"
      disabled={busy}
      onClick={() =>
        archive.mutate(
          { id: node.id },
          {
            onSuccess: () =>
              onNotice('Card archived.', { label: 'Undo', onClick: () => restore.mutate({ id: node.id }) }),
            onError: () => onNotice('That card couldn’t be archived.'),
          },
        )
      }
      sx={{ color: neutral.muted, borderColor: neutral.lineStrong }}
    >
      Archive card
    </Button>
  );
}

/** Puts an open card in its domain's focus block, or takes it out. */
function FocusControl({ node, onNotice }: { node: NodeDetail; onNotice: ShowNotice }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const palette = useDomainPalette();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.node.detail.queryKey({ id: node.id }) });
    void queryClient.invalidateQueries({ queryKey: trpc.today.pathKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.domain.pathKey() });
  };
  const add = useMutation(trpc.focus.add.mutationOptions({ onSettled: refresh }));
  const remove = useMutation(trpc.focus.remove.mutationOptions({ onSettled: refresh }));

  if (!node.inFocus && (node.completedAt || node.archivedAt)) return null;

  const toggle = () =>
    node.inFocus
      ? remove.mutate(
          { id: node.id },
          {
            onSuccess: () => onNotice('Out of the focus block.'),
            onError: () => onNotice('That card couldn’t be taken out of focus.'),
          },
        )
      : add.mutate(
          { id: node.id },
          {
            onSuccess: () => onNotice(`In the ${node.domain.title} focus block.`, { label: 'Open Today', href: todayPath }),
            onError: () => onNotice('That card couldn’t join the focus block.'),
          },
        );

  return (
    <Button
      size="small"
      variant="outlined"
      color="inherit"
      disabled={add.isPending || remove.isPending}
      onClick={toggle}
      sx={{
        color: node.inFocus ? palette.accent : neutral.muted,
        borderColor: node.inFocus ? palette.border : neutral.lineStrong,
      }}
    >
      {node.inFocus ? 'Remove from focus' : 'Add to focus'}
    </Button>
  );
}

/**
 * Another cluster for the card, in any domain. Picking one moves it straight
 * away, with Undo; the drawer stays on the card so you can see where it went.
 */
function MoveCard({ node, onDone, onNotice }: { node: NodeDetail; onDone: () => void; onNotice: ShowNotice }) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const palette = useDomainPalette();
  const { data: domains, isError } = useQuery(trpc.domain.cloud.queryOptions());
  const [domainSlug, setDomainSlug] = useState<string | null>(node.domain.slug);

  // Two boards, their memory and every count above them change.
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.cluster.pathKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.domain.pathKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.memory.pathKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.node.detail.queryKey({ id: node.id }) });
  };
  const transfer = useMutation(trpc.node.transfer.mutationOptions({ onSettled: refresh }));

  // Undo can come after the drawer has closed, so it calls the client directly
  // instead of through a mutation hook tied to this component.
  const undo = (from: TransferredCard['from']) => {
    trpcClient.node.transfer.mutate({ id: node.id, ...from }).then(
      () => {
        refresh();
        onNotice('Card moved back.');
      },
      () => onNotice('That card couldn’t be moved back.'),
    );
  };

  const pick = ({ domain, cluster }: ClusterTarget) =>
    transfer.mutate(
      { id: node.id, clusterId: cluster.id },
      {
        onSuccess: (moved) => {
          onDone();
          const focus = moved.leftFocus ? ` It left the ${node.domain.title} focus block.` : '';
          onNotice(`Moved to ${domain.title} / ${cluster.title}.${focus}`, {
            label: 'Undo',
            onClick: () => undo(moved.from),
          });
        },
        onError: () => onNotice('That card couldn’t be moved.'),
      },
    );

  return (
    <Box sx={{ mt: 1.25, border: `1px solid ${palette.border}`, borderRadius: 1, px: 1.5, py: 1.25 }}>
      {domains ? (
        <ClusterPicker
          label="Move to"
          domains={domains}
          domainSlug={domainSlug}
          onDomainChange={setDomainSlug}
          onPick={pick}
          excludeClusterId={node.cluster.id}
          disabled={transfer.isPending}
        />
      ) : isError ? (
        <Quiet>The clusters couldn’t be loaded.</Quiet>
      ) : (
        <CircularProgress size={16} aria-label="Loading clusters" />
      )}
    </Box>
  );
}

function NodeDetailBody({ node, onNotice }: { node: NodeDetail; onNotice: ShowNotice }) {
  const palette = useDomainPalette();
  const [moving, setMoving] = useState(false);
  const memoryHref = clusterPath(node.domain.slug, node.cluster.slug, 'memory');
  const pills = [
    PRIORITY_LABELS[node.priority],
    ...(node.completedAt ? [`done ${formatDay(node.completedAt)}`] : []),
    ...(node.inFocus ? ['in focus block'] : []),
  ];

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2.5, pb: 3 }}>
      <Typography sx={{ fontSize: 9.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: palette.accent }}>
        {node.kind === 'TOPIC' ? 'Topic' : 'Task'}
      </Typography>
      <Typography component="h2" sx={{ fontSize: 17, fontWeight: 500, lineHeight: 1.4, mt: 1 }}>
        {node.title}
      </Typography>
      <Typography sx={{ fontSize: 10.5, letterSpacing: '0.04em', color: 'text.secondary', mt: 0.75 }}>
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

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: 1.75 }}>
        <FocusControl node={node} onNotice={onNotice} />
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          aria-expanded={moving}
          onClick={() => setMoving((open) => !open)}
          sx={{ color: moving ? palette.accent : neutral.muted, borderColor: neutral.lineStrong }}
        >
          Move card
        </Button>
        <ArchiveControl node={node} onNotice={onNotice} />
      </Box>
      {moving && <MoveCard node={node} onDone={() => setMoving(false)} onNotice={onNotice} />}

      <Section title="Description">
        {node.description ? <Markdown size="compact">{node.description}</Markdown> : <Quiet>No description.</Quiet>}
      </Section>

      {node.attachments.length > 0 && (
        <Section title={plural(node.attachments.length, 'attachment')}>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
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
                    <Typography sx={{ fontSize: 10, color: 'text.secondary', mt: 0.25 }}>{details.join(' · ')}</Typography>
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
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
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
                    <Typography sx={{ fontSize: 13.5, lineHeight: 1.4, mt: 0.25 }}>{entry.title}</Typography>
                    <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.25 }}>{entry.description}</Typography>
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

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Box component="section" sx={{ mt: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1 }}>
        <Typography
          component="h3"
          sx={{ fontSize: 9.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'text.secondary' }}
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
