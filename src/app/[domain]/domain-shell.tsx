'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { DomainTheme, useDomainPalette } from '@/components/domain-theme';
import { SegmentGroup, segmentSx } from '@/components/segmented';
import { oklch, oklcha } from '@/lib/color';
import { plural } from '@/lib/format';
import { domainPalette, neutral } from '@/lib/palette';
import type { DomainSummary } from '@/server/services/domains';
import { useTRPC } from '@/trpc/client';

/** Sections a domain will have. Only the cloud exists in this prototype. */
const LATER_SECTIONS = ['Inbox', 'Focus', 'Journal'] as const;

/** The frame around everything in a domain: domain rail, header, and the section below. */
export function DomainShell({ domainSlug, children }: { domainSlug: string; children: ReactNode }) {
  const trpc = useTRPC();
  const { data: domains } = useSuspenseQuery(trpc.domain.list.queryOptions());
  const domain = domains.find((d) => d.slug === domainSlug);
  // The layout has already 404'd an unknown slug.
  if (!domain) return null;

  return (
    <DomainTheme hue={domain.themeHue}>
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
        pt: 2.25,
        pb: 2,
      }}
    >
      <Box
        aria-hidden
        sx={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: `radial-gradient(circle at 32% 28%, ${oklch(0.86, 0.06, 250)}, ${oklch(0.42, 0.1, 250)} 70%, ${oklch(0.28, 0.05, 250)})`,
          boxShadow: `0 0 18px ${oklcha(0.55, 0.12, 250, 0.45)}`,
        }}
      />
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
        <Typography
          component="span"
          sx={{ fontSize: 9.5, letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          {domain.title.slice(0, 3)}
        </Typography>
      </ButtonBase>
    </Tooltip>
  );
}

function DomainHeader({ domain }: { domain: DomainSummary }) {
  const palette = useDomainPalette();
  const meta = [
    plural(domain.openNodeCount, 'open card'),
    plural(domain.clusterCount, 'cluster'),
    `${domain.inboxCount} in inbox`,
    ...(domain.pendingMemoryCount
      ? [`${plural(domain.pendingMemoryCount, 'memory', 'memories')} to review`]
      : []),
  ].join(' · ');

  return (
    <Box
      component="header"
      sx={{
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 1.75,
        flexWrap: 'wrap',
        px: 2.75,
        py: 1.75,
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
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
        <Typography sx={{ fontSize: 10.5, letterSpacing: '0.04em', color: 'text.secondary' }}>
          {meta}
        </Typography>
      </Box>
      <Box sx={{ flex: 1 }} />
      <SegmentGroup label="Sections">
        <ButtonBase
          component={Link}
          href={`/${domain.slug}`}
          aria-current="page"
          sx={{ ...segmentSx(true, palette), fontSize: 12.5, px: 1.6, py: 0.85 }}
        >
          Cloud
        </ButtonBase>
        {LATER_SECTIONS.map((label) => (
          <Tooltip key={label} title="Not in this prototype">
            <span>
              <ButtonBase
                disabled
                sx={{ ...segmentSx(false, palette), fontSize: 12.5, px: 1.6, py: 0.85, opacity: 0.45 }}
              >
                {label}
              </ButtonBase>
            </span>
          </Tooltip>
        ))}
      </SegmentGroup>
    </Box>
  );
}
