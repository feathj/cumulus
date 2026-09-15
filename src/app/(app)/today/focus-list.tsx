'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Checkbox from '@mui/material/Checkbox';
import MuiLink from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

import { useShowNotice } from '@/components/notice';
import { dayIn, formatShortDay } from '@/lib/day';
import { domainPalette, neutral } from '@/lib/palette';
import { cardPath, cloudPath } from '@/lib/routes';
import type { FocusCard } from '@/server/services/focus';
import { useTRPC, useTRPCClient } from '@/trpc/client';

import { SectionTitle } from './today-parts';
import type { DayInput } from './today-parts';

/**
 * Every domain's focus block in one list, each card in its domain's colour.
 * Checking a card off completes it, and it stays, struck through, for the rest
 * of the day. Open cards carry over, marked with the day they were queued.
 */
export function FocusList({ input, cards, today }: { input: DayInput; cards: FocusCard[]; today: string }) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const show = useShowNotice();
  const dayQueryKey = trpc.today.day.queryKey(input);

  // A card's state also shows on its board, in its drawer and in the counts above.
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.today.pathKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.cluster.pathKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.domain.pathKey() });
    void queryClient.invalidateQueries({ queryKey: trpc.node.pathKey() });
  };

  // The checkbox ticks straight away; the server catches up.
  const markDone = async (nodeId: string, completedAt: Date | null) => {
    await queryClient.cancelQueries({ queryKey: dayQueryKey });
    queryClient.setQueryData(dayQueryKey, (old) =>
      old?.focus
        ? { ...old, focus: old.focus.map((card) => (card.nodeId === nodeId ? { ...card, completedAt } : card)) }
        : old,
    );
  };
  const complete = useMutation(
    trpc.node.complete.mutationOptions({
      onMutate: ({ id }) => markDone(id, new Date()),
      onError: () => show('That card couldn’t be checked off.'),
      onSettled: refresh,
    }),
  );
  const reopen = useMutation(
    trpc.node.reopen.mutationOptions({
      onMutate: ({ id }) => markDone(id, null),
      onError: () => show('That card couldn’t be reopened.'),
      onSettled: refresh,
    }),
  );
  const remove = useMutation(trpc.focus.remove.mutationOptions({ onSettled: refresh }));

  // Undo can come after the list has changed, so it calls the client directly.
  const takeOut = (card: FocusCard) =>
    remove.mutate(
      { id: card.nodeId },
      {
        onSuccess: () =>
          show(`Took ${card.title} out of focus.`, {
            label: 'Undo',
            onClick: () => {
              trpcClient.focus.add
                .mutate({ id: card.nodeId })
                .then(refresh, () => show(`${card.title} couldn’t go back into focus.`));
            },
          }),
        onError: () => show('That card couldn’t be taken out of focus.'),
      },
    );

  const groups: { domain: FocusCard['domain']; cards: FocusCard[] }[] = [];
  for (const card of cards) {
    const last = groups.at(-1);
    if (last?.domain.slug === card.domain.slug) last.cards.push(card);
    else groups.push({ domain: card.domain, cards: [card] });
  }

  const doneCount = cards.filter((card) => card.completedAt).length;
  const meta = cards.length ? `${cards.length - doneCount} open${doneCount ? ` · ${doneCount} done` : ''}` : undefined;

  return (
    <Box component="section" aria-labelledby="focus-heading" sx={{ minWidth: 0 }}>
      <SectionTitle id="focus-heading" title="Focus" meta={meta} />
      {groups.length === 0 ? (
        <Typography
          sx={{
            fontSize: 13.5,
            lineHeight: 1.55,
            color: 'text.secondary',
            border: `1px dashed ${neutral.line}`,
            borderRadius: 1.5,
            px: 2,
            py: 2.5,
          }}
        >
          Nothing in focus. Open a card in the{' '}
          <MuiLink component={Link} href={cloudPath}>
            cloud
          </MuiLink>{' '}
          and choose “Add to focus”. Cards stay here, day to day, until they’re done.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
          {groups.map((group) => {
            const colors = domainPalette(group.domain.themeHue);
            return (
              <Box key={group.domain.slug}>
                <Typography
                  component="h4"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    mb: 0.75,
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: colors.accent,
                  }}
                >
                  <Box component="span" aria-hidden sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: colors.accentBright }} />
                  {group.domain.title}
                </Typography>
                <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                  {group.cards.map((card) => (
                    <FocusRow
                      key={card.nodeId}
                      card={card}
                      timeZone={input.timeZone}
                      today={today}
                      onToggle={() => (card.completedAt ? reopen : complete).mutate({ id: card.nodeId })}
                      onRemove={() => takeOut(card)}
                    />
                  ))}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function FocusRow({
  card,
  timeZone,
  today,
  onToggle,
  onRemove,
}: {
  card: FocusCard;
  timeZone: string;
  today: string;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const colors = domainPalette(card.domain.themeHue);
  const done = card.completedAt !== null;
  const queued = dayIn(card.addedAt, timeZone);
  const details = [
    card.cluster.title,
    ...(done ? ['done today'] : queued < today ? [`waiting since ${formatShortDay(queued, today)}`] : []),
  ];

  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        pl: 0.5,
        pr: 0.75,
        py: 0.6,
        border: `1px solid ${neutral.line}`,
        borderLeft: `3px solid ${done ? neutral.lineStrong : colors.border}`,
        borderRadius: 1,
        bgcolor: done ? 'transparent' : neutral.surface,
        transition: 'background-color 160ms ease, border-color 160ms ease',
      }}
    >
      <Checkbox
        checked={done}
        onChange={onToggle}
        size="small"
        slotProps={{ input: { 'aria-label': done ? `Reopen ${card.title}` : `Check off ${card.title}` } }}
        sx={{ color: colors.border, '&.Mui-checked': { color: colors.accent } }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <MuiLink
          component={Link}
          href={cardPath(card.domain.slug, card.cluster.slug, card.nodeId)}
          underline="none"
          sx={{
            display: 'block',
            fontSize: 14.5,
            lineHeight: 1.4,
            color: done ? neutral.muted : neutral.text,
            textDecoration: done ? 'line-through' : 'none',
            overflowWrap: 'anywhere',
            '&:hover': { color: done ? neutral.textSoft : colors.accent },
          }}
        >
          {card.title}
        </MuiLink>
        <Typography sx={{ fontSize: 10.5, letterSpacing: '0.03em', color: 'text.secondary', mt: 0.25 }}>
          {details.join(' · ')}
        </Typography>
      </Box>
      <ButtonBase
        aria-label={`Take ${card.title} out of focus`}
        onClick={onRemove}
        sx={{
          width: 28,
          height: 28,
          borderRadius: 1,
          fontSize: 12,
          color: neutral.muted,
          '&:hover': { color: neutral.text, bgcolor: neutral.raised },
        }}
      >
        ✕
      </ButtonBase>
    </Box>
  );
}
