'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { Priority } from '@prisma/client';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

import { serif } from '@/app/theme';
import { ClusterPicker } from '@/components/cluster-picker';
import type { ClusterTarget } from '@/components/cluster-picker';
import { DomainTheme, useDomainPalette } from '@/components/domain-theme';
import { useShowNotice } from '@/components/notice';
import type { ShowNotice } from '@/components/notice';
import { SegmentGroup, segmentSx } from '@/components/segmented';
import { PRIORITIES } from '@/lib/board';
import { oklch } from '@/lib/color';
import { formatDay, formatTime } from '@/lib/format';
import { splitIdea } from '@/lib/ideas';
import { domainPalette, neutral } from '@/lib/palette';
import { cardPath } from '@/lib/routes';
import type { DomainCloudEntry } from '@/server/services/domains';
import type { FileInboxItemInput, InboxItemView } from '@/server/services/inbox';
import { useTRPC } from '@/trpc/client';

const PRIORITY_LABELS: Record<Priority, string> = { NOW: 'Now', NEXT: 'Next', SOMEDAY: 'Someday' };

const quietButtonSx = {
  border: `1px solid ${neutral.line}`,
  borderRadius: 0.75,
  px: 1.4,
  py: 0.6,
  fontSize: 11.5,
  letterSpacing: '0.03em',
  color: neutral.muted,
  '&:hover': { color: neutral.text, borderColor: neutral.lineStrong },
} as const;

const overlineSx = {
  fontSize: 9.5,
  letterSpacing: '0.09em',
  textTransform: 'uppercase',
  color: 'text.secondary',
} as const;

/** Where a capture is being filed: a cluster, and the domain it's in. */
type FilingTarget = ClusterTarget;

/** Everything the inbox can do to a capture, with its confirmations. */
function useInboxActions(show: ShowNotice) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.inbox.pathKey() });
  };

  const update = useMutation(trpc.inbox.update.mutationOptions({ onSettled: refresh }));
  const archive = useMutation(trpc.inbox.archive.mutationOptions({ onSettled: refresh }));
  const restore = useMutation(trpc.inbox.restore.mutationOptions({ onSettled: refresh }));
  const file = useMutation(
    trpc.inbox.file.mutationOptions({
      onSettled: () => {
        refresh();
        // A new card changes cluster boards and every count above them.
        void queryClient.invalidateQueries({ queryKey: trpc.cluster.pathKey() });
        void queryClient.invalidateQueries({ queryKey: trpc.domain.pathKey() });
      },
    }),
  );

  return {
    saving: update.isPending,
    filing: file.isPending,

    update: (item: InboxItemView, text: string, onDone: () => void) =>
      update.mutate(
        { id: item.id, text },
        { onSuccess: onDone, onError: () => show('That edit didn’t save.') },
      ),

    archive: (item: InboxItemView) =>
      archive.mutate(
        { id: item.id },
        {
          onSuccess: () => show('Archived.', { label: 'Undo', onClick: () => restore.mutate({ id: item.id }) }),
          onError: () => show('That couldn’t be archived.'),
        },
      ),

    restore: (item: InboxItemView) =>
      restore.mutate(
        { id: item.id },
        { onSuccess: () => show('Back in the inbox.'), onError: () => show('That couldn’t be restored.') },
      ),

    file: (input: FileInboxItemInput, target: FilingTarget) =>
      file.mutate(input, {
        onSuccess: (card) =>
          show(`Filed into ${target.domain.title} / ${target.cluster.title}.`, {
            label: 'Open card',
            href: cardPath(card.domainSlug, card.clusterSlug, card.nodeId),
          }),
        onError: () => show('That didn’t file, so it’s still here.'),
      }),
  };
}

type InboxActions = ReturnType<typeof useInboxActions>;

/**
 * The one inbox, for every domain. Each capture can be refined, filed into a
 * domain's cluster as a card — with a title, description and priority — or
 * archived.
 */
export function InboxView() {
  const trpc = useTRPC();
  const { data: inbox } = useSuspenseQuery(trpc.inbox.list.queryOptions());
  const { data: domains } = useSuspenseQuery(trpc.domain.cloud.queryOptions());
  const show = useShowNotice();
  const actions = useInboxActions(show);
  const [showArchived, setShowArchived] = useState(false);

  return (
    <Box sx={{ position: 'absolute', inset: 0, overflowY: 'auto', px: { xs: 2.5, md: 5 }, pt: 4.5, pb: 7 }}>
      <Box sx={{ maxWidth: 760 }}>
        <Typography
          component="h2"
          sx={{ fontSize: 15, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          Inbox
        </Typography>
        <Typography sx={{ mt: 0.5, mb: 2.75, fontSize: 13.5, lineHeight: 1.5, color: 'text.secondary', maxWidth: '58ch' }}>
          Everything you caught, from anywhere, before deciding where it goes. Refine it, file it into
          a domain and cluster, or archive it — one at a time. The pile is allowed to exist.
        </Typography>

        {inbox.items.length > 0 ? (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {inbox.items.map((item) => (
              <li key={item.id}>
                <InboxCard item={item} domains={domains} actions={actions} />
              </li>
            ))}
          </Box>
        ) : (
          <Typography
            sx={{
              border: `1px dashed ${oklch(0.27, 0.014, 265)}`,
              borderRadius: 1.75,
              px: 2.5,
              py: 4.25,
              textAlign: 'center',
              fontSize: 14,
              lineHeight: 1.5,
              color: neutral.muted,
            }}
          >
            Inbox clear. Nothing waiting on a decision.
            <br />
            Catch a thought in the box above, or press / from anywhere.
          </Typography>
        )}

        {inbox.archived.length > 0 && (
          <Box sx={{ mt: 4.5 }}>
            <ButtonBase
              onClick={() => setShowArchived((shown) => !shown)}
              aria-expanded={showArchived}
              sx={{ ...overlineSx, '&:hover': { color: neutral.text } }}
            >
              {showArchived ? 'Hide' : 'Show'} archived · {inbox.archived.length}
            </ButtonBase>
            {showArchived && (
              <Box
                component="ul"
                sx={{ listStyle: 'none', m: 0, mt: 1.25, p: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}
              >
                {inbox.archived.map((item) => (
                  <Box
                    component="li"
                    key={item.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      border: `1px solid ${oklch(0.234, 0.01, 265)}`,
                      bgcolor: oklch(0.149, 0.008, 265),
                      borderRadius: 1,
                      px: 1.75,
                      py: 1,
                    }}
                  >
                    <Typography
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 13.5,
                        color: oklch(0.633, 0.008, 265),
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.text}
                    </Typography>
                    <Typography sx={{ fontSize: 9.5, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      archived {formatDay(item.archivedAt ?? item.capturedAt)}
                    </Typography>
                    <ButtonBase onClick={() => actions.restore(item)} sx={quietButtonSx}>
                      Restore
                    </ButtonBase>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

type Mode = { kind: 'reading' } | { kind: 'refining' } | { kind: 'filing'; target: FilingTarget };

function InboxCard({
  item,
  domains,
  actions,
}: {
  item: InboxItemView;
  domains: DomainCloudEntry[];
  actions: InboxActions;
}) {
  const palette = useDomainPalette();
  const [mode, setMode] = useState<Mode>({ kind: 'reading' });
  // Start from the domain the idea arrived with, if it came with one.
  const [domainSlug, setDomainSlug] = useState<string | null>(item.domain?.slug ?? null);
  const reading = () => setMode({ kind: 'reading' });

  const borderColor =
    mode.kind === 'reading'
      ? oklch(0.256, 0.014, 265)
      : mode.kind === 'filing'
        ? domainPalette(mode.target.domain.themeHue).border
        : palette.border;

  return (
    <Box
      component="article"
      aria-label={item.text.split('\n')[0]}
      sx={{
        border: `1px solid ${borderColor}`,
        bgcolor: oklch(0.176, 0.013, 265),
        borderRadius: 1.75,
        px: 2,
        py: 1.9,
        transition: 'border-color 140ms ease',
      }}
    >
      {mode.kind === 'refining' ? (
        <RefineIdea
          item={item}
          saving={actions.saving}
          onCancel={reading}
          onSave={(text) => actions.update(item, text, reading)}
        />
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Typography
            sx={{
              flex: 1,
              minWidth: 0,
              fontFamily: serif,
              fontSize: 17,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
          >
            {item.text}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'text.secondary', whiteSpace: 'nowrap', pt: 0.6 }}>
            {formatDay(item.capturedAt)} · {formatTime(item.capturedAt)}
          </Typography>
        </Box>
      )}

      {mode.kind === 'filing' && (
        // The form takes on the colours of the domain it's filing into.
        <DomainTheme hue={mode.target.domain.themeHue}>
          <FileIdea
            item={item}
            target={mode.target}
            filing={actions.filing}
            onCancel={reading}
            onFile={(input) => actions.file(input, mode.target)}
          />
        </DomainTheme>
      )}

      {mode.kind === 'reading' && (
        <>
          <Box sx={{ mt: 1.6 }}>
            <ClusterPicker
              label="File into"
              domains={domains}
              domainSlug={domainSlug}
              onDomainChange={setDomainSlug}
              onPick={(target) => setMode({ kind: 'filing', target })}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
            <ButtonBase onClick={() => setMode({ kind: 'refining' })} sx={quietButtonSx}>
              Refine
            </ButtonBase>
            <ButtonBase onClick={() => actions.archive(item)} sx={quietButtonSx}>
              Archive
            </ButtonBase>
          </Box>
        </>
      )}
    </Box>
  );
}

/** Escape cancels, Cmd/Ctrl+Enter submits the surrounding form. */
function formShortcuts(onCancel: () => void) {
  return (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  };
}

function RefineIdea({
  item,
  saving,
  onSave,
  onCancel,
}: {
  item: InboxItemView;
  saving: boolean;
  onSave: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(item.text);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    if (value === item.text) onCancel();
    else onSave(value);
  };

  return (
    <Box component="form" onSubmit={submit} onKeyDown={formShortcuts(onCancel)}>
      <TextField
        label="Refine the idea"
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoFocus
        multiline
        minRows={2}
        fullWidth
        slotProps={{ htmlInput: { maxLength: 5000 } }}
        sx={{ '& textarea': { fontFamily: serif, fontSize: 16, lineHeight: 1.5 } }}
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.25 }}>
        <Typography sx={{ fontSize: 10, color: 'text.secondary', mr: 'auto' }}>
          ⌘/Ctrl + Enter to save · Esc to cancel
        </Typography>
        <Button size="small" color="inherit" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="small" variant="outlined" disabled={saving || !text.trim()}>
          Save
        </Button>
      </Box>
    </Box>
  );
}

function FileIdea({
  item,
  target,
  filing,
  onFile,
  onCancel,
}: {
  item: InboxItemView;
  target: FilingTarget;
  filing: boolean;
  onFile: (input: FileInboxItemInput) => void;
  onCancel: () => void;
}) {
  const palette = useDomainPalette();
  const [suggestion] = useState(() => splitIdea(item.text));
  const [title, setTitle] = useState(suggestion.title);
  const [description, setDescription] = useState(suggestion.description ?? '');
  const [priority, setPriority] = useState<Priority>('NEXT');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    onFile({
      id: item.id,
      clusterId: target.cluster.id,
      title: title.trim(),
      description: description.trim() || null,
      priority,
    });
  };

  const destination = `${target.domain.title} / ${target.cluster.title}`;

  return (
    <Box
      component="form"
      onSubmit={submit}
      onKeyDown={formShortcuts(onCancel)}
      aria-label={`File into ${destination}`}
      sx={{
        mt: 1.75,
        pt: 1.75,
        borderTop: `1px solid ${neutral.line}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.6,
      }}
    >
      <Typography sx={{ ...overlineSx, color: palette.accent }}>File into {destination}</Typography>
      <TextField
        label="Card title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        autoFocus
        fullWidth
        size="small"
        slotProps={{ htmlInput: { maxLength: 200 } }}
      />
      <TextField
        label="Description (markdown, optional)"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        multiline
        minRows={2}
        fullWidth
        size="small"
      />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
        <Typography component="span" sx={overlineSx}>
          Priority
        </Typography>
        <SegmentGroup label="Priority">
          {PRIORITIES.map((option) => (
            <ButtonBase
              key={option}
              onClick={() => setPriority(option)}
              aria-pressed={priority === option}
              sx={segmentSx(priority === option, palette)}
            >
              {PRIORITY_LABELS[option]}
            </ButtonBase>
          ))}
        </SegmentGroup>
        <Box sx={{ flex: 1 }} />
        <Button size="small" color="inherit" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="small" variant="outlined" disabled={filing || !title.trim()}>
          File card
        </Button>
      </Box>
    </Box>
  );
}
