'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { serif } from '@/app/theme';
import { useDomainPalette } from '@/components/domain-theme';
import { formatLongDay, shiftDay, TIME_ZONE_COOKIE } from '@/lib/day';
import { neutral } from '@/lib/palette';
import { dayPath, todayPath } from '@/lib/routes';
import { useTRPC } from '@/trpc/client';

import { DoneList } from './done-list';
import { FocusList } from './focus-list';
import { JournalPad } from './journal-pad';
import { RoutineStrip } from './routine-strip';

/**
 * Tells the server the browser's time zone through a cookie, and re-renders
 * if the page was drawn in a different one. The cookie check stops a zone the
 * server can't read from refreshing forever.
 */
function useBrowserTimeZone(timeZone: string) {
  const router = useRouter();

  useEffect(() => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!browser || browser === timeZone) return;
    const stored = document.cookie
      .split('; ')
      .find((cookie) => cookie.startsWith(`${TIME_ZONE_COOKIE}=`))
      ?.slice(TIME_ZONE_COOKIE.length + 1);
    if (stored === browser) return;
    document.cookie = `${TIME_ZONE_COOKIE}=${browser}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [timeZone, router]);
}

/** One day: routines to check off, the focus blocks when it's today, and the journal. */
export function TodayView({ day, timeZone }: { day: string; timeZone: string }) {
  const trpc = useTRPC();
  useBrowserTimeZone(timeZone);
  const input = { day, timeZone };
  const { data } = useSuspenseQuery(trpc.today.day.queryOptions(input));
  const isToday = data.day === data.today;

  return (
    <Box sx={{ position: 'absolute', inset: 0, overflowY: 'auto', px: { xs: 2.5, md: 5 }, pt: 4, pb: 7 }}>
      <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
        <DayHeader day={data.day} today={data.today} />
        <RoutineStrip input={input} routines={data.routines} />
        <Box
          sx={{
            mt: 4,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 5fr) minmax(0, 6fr)' },
            gap: { xs: 4, md: 4.5 },
            alignItems: 'start',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5, minWidth: 0 }}>
            {data.focus ? (
              <FocusList input={input} cards={data.focus} today={data.today} />
            ) : (
              <Typography sx={{ fontSize: 12.5, lineHeight: 1.55, color: 'text.secondary' }}>
                The focus block is only on today. Cards wait in it until they’re checked off, however many days
                that takes — what they came to shows up here, on the day it happened.
              </Typography>
            )}
            <DoneList input={input} cards={data.done} isToday={isToday} />
          </Box>
          <JournalPad
            key={data.day}
            input={input}
            journal={data.journal}
            startReading={!isToday && data.journal.body.trim() !== ''}
          />
        </Box>
      </Box>
    </Box>
  );
}

function DayHeader({ day, today }: { day: string; today: string }) {
  const palette = useDomainPalette();
  const hrefFor = (key: string) => (key === today ? todayPath : dayPath(key));
  const label = day === today ? 'Today' : day < today ? 'Looking back' : 'Looking ahead';

  return (
    <Box component="header" sx={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, flexWrap: 'wrap' }}>
      <Box sx={{ mr: 'auto', minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 9.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: day === today ? palette.accent : 'text.secondary',
          }}
        >
          {label}
        </Typography>
        <Typography component="h2" sx={{ fontFamily: serif, fontSize: 27, lineHeight: 1.25, mt: 0.5 }}>
          {formatLongDay(day, today)}
        </Typography>
      </Box>
      <Box component="nav" aria-label="Days" sx={{ display: 'flex', gap: 0.75 }}>
        <DayLink href={hrefFor(shiftDay(day, -1))} label="Previous day">
          ←
        </DayLink>
        {day !== today && <DayLink href={todayPath}>Today</DayLink>}
        <DayLink href={hrefFor(shiftDay(day, 1))} label="Next day">
          →
        </DayLink>
      </Box>
    </Box>
  );
}

function DayLink({ href, label, children }: { href: string; label?: string; children: string }) {
  return (
    <ButtonBase
      component={Link}
      href={href}
      aria-label={label}
      sx={{
        minWidth: 34,
        height: 32,
        px: 1.25,
        border: `1px solid ${neutral.line}`,
        borderRadius: 1,
        fontSize: 13,
        color: neutral.muted,
        '&:hover': { color: neutral.text, borderColor: neutral.lineStrong },
      }}
    >
      {children}
    </ButtonBase>
  );
}
