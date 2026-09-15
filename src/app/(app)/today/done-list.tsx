'use client';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import MuiLink from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

import { useShowNotice } from '@/components/notice';
import { formatTime, plural } from '@/lib/format';
import { domainPalette, neutral } from '@/lib/palette';
import { cardPath } from '@/lib/routes';
import type { DoneCard } from '@/server/services/focus';
import { useTRPC } from '@/trpc/client';

import { SectionTitle, useDayRefresh } from './today-parts';
import type { DayInput } from './today-parts';

/**
 * What was checked off on this day, in the order it was done — the log of what
 * a day came to. It keeps its day for good, whether or not the card was ever
 * in a focus block. Un-ticking a card reopens it, back into the queue if it
 * was queued.
 */
export function DoneList({ input, cards, isToday }: { input: DayInput; cards: DoneCard[]; isToday: boolean }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const show = useShowNotice();
  const refresh = useDayRefresh();
  const dayQueryKey = trpc.today.day.queryKey(input);

  const reopen = useMutation(
    trpc.node.reopen.mutationOptions({
      onMutate: async ({ id }) => {
        await queryClient.cancelQueries({ queryKey: dayQueryKey });
        queryClient.setQueryData(dayQueryKey, (old) =>
          old ? { ...old, done: old.done.filter((card) => card.nodeId !== id) } : old,
        );
      },
      onError: () => show('That card couldn’t be reopened.'),
      onSettled: refresh,
    }),
  );

  return (
    <Box component="section" aria-labelledby="done-heading" sx={{ minWidth: 0 }}>
      <SectionTitle id="done-heading" title="Done" meta={cards.length ? plural(cards.length, 'card') : undefined} />
      {cards.length === 0 ? (
        <Typography sx={{ fontSize: 13.5, lineHeight: 1.55, color: 'text.secondary' }}>
          {isToday ? 'Nothing checked off yet today.' : 'Nothing was checked off this day.'}
        </Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {cards.map((card) => {
            const colors = domainPalette(card.domain.themeHue);
            return (
              <Box
                component="li"
                key={card.nodeId}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  pl: 0.5,
                  pr: 1,
                  py: 0.35,
                  borderLeft: `3px solid ${neutral.lineStrong}`,
                  borderRadius: 1,
                }}
              >
                <Checkbox
                  checked
                  onChange={() => reopen.mutate({ id: card.nodeId })}
                  size="small"
                  slotProps={{ input: { 'aria-label': `Reopen ${card.title}` } }}
                  sx={{ color: colors.border, '&.Mui-checked': { color: colors.accent } }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <MuiLink
                    component={Link}
                    href={cardPath(card.domain.slug, card.cluster.slug, card.nodeId)}
                    underline="none"
                    sx={{
                      display: 'block',
                      fontSize: 14,
                      lineHeight: 1.4,
                      color: neutral.muted,
                      textDecoration: 'line-through',
                      overflowWrap: 'anywhere',
                      '&:hover': { color: neutral.textSoft },
                    }}
                  >
                    {card.title}
                  </MuiLink>
                  <Typography sx={{ fontSize: 10.5, letterSpacing: '0.03em', color: 'text.secondary', mt: 0.15 }}>
                    {formatTime(card.completedAt)} · {card.domain.title} / {card.cluster.title}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
