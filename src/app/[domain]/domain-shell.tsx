'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import InputBase from '@mui/material/InputBase';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

import { DomainTheme, useDomainPalette } from '@/components/domain-theme';
import { NoticeProvider, useShowNotice } from '@/components/notice';
import { SegmentGroup, segmentSx } from '@/components/segmented';
import { oklch, oklcha } from '@/lib/color';
import { plural } from '@/lib/format';
import { domainPalette, neutral } from '@/lib/palette';
import type { DomainSummary } from '@/server/services/domains';
import { useTRPC } from '@/trpc/client';

/** Sections a domain will have that don't exist yet. */
const LATER_SECTIONS = ['Focus', 'Journal'] as const;

/** The frame around everything in a domain: domain rail, header with capture box, and the section below. */
export function DomainShell({ domainSlug, children }: { domainSlug: string; children: ReactNode }) {
  const trpc = useTRPC();
  const { data: domains } = useSuspenseQuery(trpc.domain.list.queryOptions());
  const domain = domains.find((d) => d.slug === domainSlug);
  // The layout has already 404'd an unknown slug.
  if (!domain) return null;

  return (
    <DomainTheme hue={domain.themeHue}>
      <NoticeProvider>
        <Box
          sx={{
            display: 'flex',
            height: '100dvh',
            minHeight: 420,
            overflow: 'hidden',
            color: neutral.text,
            background: `radial-gradient(120% 90% at 50% 0%, ${neutral.canvasGlow} 0%, ${neutral.canvas} 62%)`,
          }}
        >
          <DomainRail domains={domains} activeSlug={domainSlug} />
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <DomainHeader domain={domain} />
            <Box component="main" sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
              {children}
            </Box>
          </Box>
        </Box>
      </NoticeProvider>
    </DomainTheme>
  );
}

function DomainRail({ domains, activeSlug }: { domains: DomainSummary[]; activeSlug: string }) {
  return (
    <Box
      component="nav"
      aria-label="Domains"
      sx={{
        width: 78,
        flex: '0 0 78px',
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: neutral.rail,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2.75,
        pt: 1.5,
        pb: 2,
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {domains.map((domain) => (
          <DomainChip key={domain.id} domain={domain} active={domain.slug === activeSlug} />
        ))}
      </Box>
      <Box sx={{ flex: 1 }} />
      <Typography
        aria-hidden
        sx={{ writingMode: 'vertical-rl', fontSize: 9, letterSpacing: '0.18em', color: 'text.secondary' }}
      >
        CUMULUS
      </Typography>
    </Box>
  );
}

function DomainChip({ domain, active }: { domain: DomainSummary; active: boolean }) {
  const hue = domain.themeHue;
  const palette = domainPalette(hue);
  return (
    <Tooltip title={domain.title} placement="right">
      <ButtonBase
        component={Link}
        href={`/${domain.slug}`}
        aria-label={domain.title}
        aria-current={active ? 'page' : undefined}
        sx={{
          width: 52,
          flexDirection: 'column',
          gap: 0.75,
          pt: '11px',
          pb: '9px',
          borderRadius: 1.25,
          border: `1px solid ${active ? oklch(0.48, 0.1, hue) : neutral.line}`,
          bgcolor: active ? oklch(0.29, 0.06, hue) : oklch(0.162, 0.008, 265),
          color: active ? oklch(0.88, 0.12, hue) : 'text.secondary',
          transition: 'all 160ms ease',
          '&:hover': { borderColor: active ? oklch(0.58, 0.12, hue) : neutral.lineStrong },
        }}
      >
        <Box
          component="span"
          sx={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            bgcolor: active ? palette.accentBright : oklch(0.4, 0.03, hue),
            boxShadow: active ? `0 0 12px ${oklcha(0.78, 0.16, hue, 0.75)}` : 'none',
          }}
        />
        <Typography component="span" sx={{ fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {domain.title.slice(0, 3)}
        </Typography>
      </ButtonBase>
    </Tooltip>
  );
}

function DomainHeader({ domain }: { domain: DomainSummary }) {
  const palette = useDomainPalette();
  const pathname = usePathname();
  const inInbox = pathname === `/${domain.slug}/inbox`;

  const meta = [
    plural(domain.openNodeCount, 'open card'),
    plural(domain.clusterCount, 'cluster'),
    `${domain.inboxCount} in inbox`,
    ...(domain.pendingMemoryCount
      ? [`${plural(domain.pendingMemoryCount, 'memory', 'memories')} to review`]
      : []),
  ].join(' · ');

  const tabSx = { fontSize: 12.5, px: 1.6, py: 0.85 } as const;

  return (
    <Box
      component="header"
      sx={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        px: 2.75,
        pt: 1.75,
        pb: 1.5,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, minWidth: 0, flexWrap: 'wrap' }}>
          <Typography
            component="h1"
            sx={{
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: '0.02em',
              textTransform: 'uppercase',
              color: palette.accent,
            }}
          >
            {domain.title}
          </Typography>
          <Typography sx={{ fontSize: 10.5, letterSpacing: '0.04em', color: 'text.secondary' }}>{meta}</Typography>
        </Box>
        <Box sx={{ flex: 1 }} />
        <SegmentGroup label="Sections">
          <ButtonBase
            component={Link}
            href={`/${domain.slug}`}
            aria-current={inInbox ? undefined : 'page'}
            sx={{ ...segmentSx(!inInbox, palette), ...tabSx }}
          >
            Cloud
          </ButtonBase>
          <ButtonBase
            component={Link}
            href={`/${domain.slug}/inbox`}
            aria-current={inInbox ? 'page' : undefined}
            aria-label={`Inbox, ${plural(domain.inboxCount, 'idea')} waiting`}
            sx={{ ...segmentSx(inInbox, palette), ...tabSx, gap: 0.9 }}
          >
            Inbox
            {domain.inboxCount > 0 && (
              <Box
                component="span"
                aria-hidden
                sx={{
                  fontSize: 10,
                  lineHeight: 1.4,
                  px: 0.75,
                  borderRadius: 0.5,
                  bgcolor: inInbox ? oklch(0.38, 0.075, palette.hue) : neutral.line,
                  color: inInbox ? oklch(0.95, 0.03, palette.hue) : neutral.textSoft,
                }}
              >
                {domain.inboxCount}
              </Box>
            )}
          </ButtonBase>
          {LATER_SECTIONS.map((label) => (
            <Tooltip key={label} title="Not built yet">
              <span>
                <ButtonBase disabled sx={{ ...segmentSx(false, palette), ...tabSx, opacity: 0.45 }}>
                  {label}
                </ButtonBase>
              </span>
            </Tooltip>
          ))}
        </SegmentGroup>
      </Box>
      <CaptureBar domainSlug={domain.slug} />
    </Box>
  );
}

/**
 * The global capture box: type a thought, press Enter, and it's in this
 * domain's inbox without deciding where it goes. `/` focuses it from
 * anywhere that isn't already a text field.
 */
function CaptureBar({ domainSlug }: { domainSlug: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const palette = useDomainPalette();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const show = useShowNotice();
  const capture = useMutation(trpc.inbox.capture.mutationOptions());

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || capture.isPending) return;
    // Clear straight away so the next thought can start; put it back if the save fails.
    setText('');
    capture.mutate(
      { domainSlug, text: value },
      {
        onSuccess: () => show('Caught. It’s in the inbox.', { label: 'Open inbox', href: `/${domainSlug}/inbox` }),
        onError: () => {
          setText((current) => current || value);
          show('That didn’t save. Your text is back in the box.');
        },
        onSettled: () => {
          void queryClient.invalidateQueries({ queryKey: trpc.domain.list.queryKey() });
          void queryClient.invalidateQueries({ queryKey: trpc.inbox.list.queryKey({ domainSlug }) });
        },
      },
    );
  };

  return (
    <Box
      component="form"
      role="search"
      aria-label="Capture an idea"
      onSubmit={submit}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        height: 46,
        pl: 1.75,
        pr: 0.75,
        bgcolor: oklch(0.182, 0.014, 265),
        border: `1px solid ${oklch(0.27, 0.016, 265)}`,
        borderRadius: 1.5,
        transition: 'border-color 140ms ease',
        '&:focus-within': { borderColor: palette.border },
      }}
    >
      <Typography aria-hidden sx={{ fontSize: 11, letterSpacing: '0.04em', color: palette.accent }}>
        &gt;
      </Typography>
      <InputBase
        inputRef={inputRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Catch a thought — Enter drops it in the inbox · / from anywhere"
        slotProps={{ input: { 'aria-label': 'Idea', maxLength: 5000 } }}
        sx={{ flex: 1, minWidth: 0, fontSize: 15, color: neutral.text }}
      />
      {text.trim() && (
        <Typography aria-hidden sx={{ fontSize: 10, color: 'text.secondary' }}>
          enter
        </Typography>
      )}
      <ButtonBase
        type="submit"
        disabled={!text.trim() || capture.isPending}
        sx={{
          border: `1px solid ${palette.border}`,
          bgcolor: palette.soft,
          color: palette.accent,
          borderRadius: 1,
          px: 1.6,
          py: 0.75,
          fontSize: 12.5,
          fontWeight: 500,
          '&:hover': { bgcolor: palette.border },
          '&.Mui-disabled': { opacity: 0.5 },
        }}
      >
        Drop
      </ButtonBase>
    </Box>
  );
}
