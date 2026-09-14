'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import type { MemoryEntryType } from '@prisma/client';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { useDomainPalette } from '@/components/domain-theme';
import { Markdown } from '@/components/markdown';
import type { WikiLinkResolver } from '@/components/markdown';
import { oklch, withAlpha } from '@/lib/color';
import { memoryTypeStyle } from '@/lib/memory-style';
import { neutral } from '@/lib/palette';

/** Width of the date/type column left of the spine. */
export const META_COLUMN = 118;
/** Width of the column the spine runs down the middle of. */
const MARKER_COLUMN = 50;

export const metaTextSx = {
  fontSize: 10.5,
  letterSpacing: '0.04em',
  lineHeight: 1.45,
  color: neutral.muted,
} as const;

export const overlineSx = {
  fontSize: 9.5,
  fontWeight: 500,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
} as const;

/** 0–1: how much an entry is actually being pulled into agent context. */
export function recallHeat(recallCount: number): number {
  return Math.min(1, recallCount / 28);
}

/** The vertical line timeline rows hang from. */
export function Spine({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        position: 'relative',
        '&::before': {
          content: '""',
          position: 'absolute',
          left: META_COLUMN + MARKER_COLUMN / 2,
          top: 0,
          bottom: 0,
          width: '1px',
          bgcolor: neutral.line,
        },
      }}
    >
      {children}
    </Box>
  );
}

/** One row on the spine: meta on the left, a marker on the line, content on the right. */
export function SpineRow({
  id,
  meta,
  marker,
  highlighted,
  dense = false,
  children,
}: {
  id: string;
  meta: ReactNode;
  marker: ReactNode;
  highlighted: boolean;
  dense?: boolean;
  children: ReactNode;
}) {
  const palette = useDomainPalette();
  return (
    <Box
      id={id}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        py: dense ? 1.25 : 2.6,
        borderBottom: `1px solid ${oklch(0.234, 0.012, 265)}`,
        scrollMarginTop: 24,
        bgcolor: highlighted ? withAlpha(palette.soft, 0.55) : 'transparent',
        transition: 'background-color 900ms ease',
      }}
    >
      <Box
        sx={{
          flex: `0 0 ${META_COLUMN}px`,
          pr: 2.5,
          textAlign: 'right',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
        }}
      >
        {meta}
      </Box>
      <Box sx={{ flex: `0 0 ${MARKER_COLUMN}px`, alignSelf: 'stretch', position: 'relative' }}>
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: 5,
            transform: 'translateX(-50%)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {marker}
        </Box>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>{children}</Box>
    </Box>
  );
}

/** A day label sitting on the spine. */
export function SpineHeading({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', pt: 3, pb: 1 }}>
      <Typography
        component="h3"
        sx={{
          ...overlineSx,
          flex: `0 0 ${META_COLUMN}px`,
          pr: 2.5,
          textAlign: 'right',
          fontSize: 10,
          color: neutral.text,
        }}
      >
        {children}
      </Typography>
      <Box
        sx={{
          width: 9,
          height: 9,
          ml: `${MARKER_COLUMN / 2 - 4.5}px`,
          borderRadius: '50%',
          bgcolor: neutral.canvas,
          border: `1px solid ${neutral.lineStrong}`,
          position: 'relative',
        }}
      />
    </Box>
  );
}

/** An entry's marker: shape and colour from its type, size and glow from how often it's recalled. */
export function TypeMarker({ type, heat }: { type: MemoryEntryType; heat: number }) {
  const { hue } = useDomainPalette();
  const style = memoryTypeStyle(type, hue);
  const size = Math.round(9 + heat * 11);
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: style.square ? '2px' : '50%',
        bgcolor: style.hollow ? neutral.canvas : style.color,
        border: `1.5px solid ${style.color}`,
        boxShadow: `0 0 ${Math.round(3 + heat * 15)}px ${withAlpha(style.color, 0.12 + heat * 0.55)}`,
      }}
    />
  );
}

/** Markdown that opens clipped when it's long, with a toggle. A clipped height of 0 hides it entirely. */
export function Expandable({
  source,
  resolveWikiLink,
  threshold = 700,
  clippedHeight = 190,
  openLabel = 'Show all',
  closeLabel = 'Show less',
  size = 'body',
}: {
  source: string;
  resolveWikiLink: WikiLinkResolver;
  threshold?: number;
  clippedHeight?: number;
  openLabel?: string;
  closeLabel?: string;
  size?: 'body' | 'compact';
}) {
  const palette = useDomainPalette();
  const [open, setOpen] = useState(false);
  const clippable = source.length > threshold;
  const clipped = clippable && !open;

  return (
    <Box>
      {!(clipped && clippedHeight === 0) && (
        <Box
          sx={{
            maxHeight: clipped ? clippedHeight : 'none',
            overflow: clipped ? 'hidden' : 'visible',
            maskImage: clipped ? 'linear-gradient(to bottom, black 55%, transparent)' : 'none',
          }}
        >
          <Markdown resolveWikiLink={resolveWikiLink} size={size}>
            {source}
          </Markdown>
        </Box>
      )}
      {clippable && (
        <ButtonBase
          onClick={() => setOpen((isOpen) => !isOpen)}
          aria-expanded={open}
          sx={{ ...overlineSx, mt: 1, color: palette.accent, '&:hover': { opacity: 0.75 } }}
        >
          {open ? closeLabel : openLabel}
        </ButtonBase>
      )}
    </Box>
  );
}

/** A labelled note beneath an entry: why, instead of, how to apply. */
export function Aside({
  label,
  children,
  resolveWikiLink,
}: {
  label: string;
  children: string;
  resolveWikiLink: WikiLinkResolver;
}) {
  return (
    <Box sx={{ mt: 1.6, borderLeft: `1px solid ${neutral.lineStrong}`, pl: 1.6, py: 0.25, maxWidth: '62ch' }}>
      <Typography component="span" sx={{ ...overlineSx, fontSize: 9, color: neutral.muted }}>
        {label}
      </Typography>
      <Box sx={{ mt: 0.5 }}>
        <Markdown size="compact" resolveWikiLink={resolveWikiLink}>
          {children}
        </Markdown>
      </Box>
    </Box>
  );
}

/** A small outlined chip that jumps to another entry or event. */
export function JumpChip({
  children,
  onClick,
  dotColor,
}: {
  children: ReactNode;
  onClick: () => void;
  dotColor?: string | undefined;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        maxWidth: '100%',
        border: `1px solid ${neutral.line}`,
        borderRadius: 0.75,
        px: 1,
        py: 0.35,
        fontSize: 11.5,
        lineHeight: 1.35,
        color: neutral.textSoft,
        textAlign: 'left',
        '&:hover': { borderColor: neutral.lineStrong, color: neutral.text },
      }}
    >
      {dotColor && (
        <Box
          component="span"
          sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: dotColor, flex: '0 0 auto' }}
        />
      )}
      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {children}
      </Box>
    </ButtonBase>
  );
}

export function SectionHeading({ title, meta }: { title: string; meta?: string | undefined }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, mb: 0.5, flexWrap: 'wrap' }}>
      <Typography component="h3" sx={{ ...overlineSx, fontSize: 10.5, color: neutral.text }}>
        {title}
      </Typography>
      {meta && <Typography sx={metaTextSx}>{meta}</Typography>}
    </Box>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <Typography
      sx={{
        maxWidth: 960,
        mx: 'auto',
        mt: 2,
        border: `1px dashed ${oklch(0.27, 0.014, 265)}`,
        borderRadius: 1.75,
        px: 2.75,
        py: 5,
        textAlign: 'center',
        fontSize: 14,
        lineHeight: 1.55,
        color: neutral.muted,
      }}
    >
      {children}
    </Typography>
  );
}
