'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import Link from 'next/link';

import { useDomainPalette } from '@/components/domain-theme';
import { withAlpha } from '@/lib/color';
import { formatDay, plural } from '@/lib/format';
import { memoryTypeStyle } from '@/lib/memory-style';
import { attention, neutral } from '@/lib/palette';
import type { MemorySummary } from '@/server/services/memory';

interface MemoryPeekProps {
  summary: MemorySummary;
  memoryHref: string;
  onClose: () => void;
}

/** What the memory orb opens: a glance at what the cluster knows and what gets used. */
export function MemoryPeek({ summary, memoryHref, onClose }: MemoryPeekProps) {
  const palette = useDomainPalette();
  const meta = [
    `${summary.activeCount} kept`,
    plural(summary.recallCount, 'pull'),
    ...(summary.latestAt ? [`newest ${formatDay(summary.latestAt)}`] : []),
  ].join(' · ');

  return (
    <Box
      role="dialog"
      aria-label="Cluster memory"
      sx={{
        position: 'absolute',
        right: 20,
        top: 16,
        width: 304,
        maxWidth: 'calc(100% - 40px)',
        zIndex: 2,
        bgcolor: neutral.surface,
        border: `1px solid ${neutral.lineStrong}`,
        borderRadius: 1.75,
        px: 1.9,
        py: 1.6,
        boxShadow: `0 16px 44px ${withAlpha(neutral.rail, 0.66)}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography
          component="h3"
          sx={{
            fontSize: 9.5,
            fontWeight: 500,
            letterSpacing: '0.13em',
            textTransform: 'uppercase',
            color: palette.accent,
          }}
        >
          Memory
        </Typography>
        <Box sx={{ flex: 1 }} />
        <ButtonBase
          aria-label="Close"
          onClick={onClose}
          sx={{ color: 'text.secondary', fontSize: 12, p: 0.5, '&:hover': { color: neutral.text } }}
        >
          ✕
        </ButtonBase>
      </Box>
      <Typography sx={{ fontSize: 10, letterSpacing: '0.05em', color: 'text.secondary', mt: 0.25 }}>
        {meta}
      </Typography>

      {summary.byType.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', mt: 1.4 }}>
          {summary.byType.map(({ type, count }) => {
            const style = memoryTypeStyle(type, palette.hue);
            return (
              <Typography
                key={type}
                component="span"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.6,
                  fontSize: 10,
                  letterSpacing: '0.04em',
                  color: neutral.textSoft,
                }}
              >
                <Box
                  component="span"
                  sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: style.color }}
                />
                {style.label} {count}
              </Typography>
            );
          })}
        </Box>
      )}

      {summary.activeCount === 0 ? (
        <Typography sx={{ fontSize: 12.5, lineHeight: 1.45, color: neutral.muted, mt: 1.25 }}>
          Nothing kept here yet. Memories arrive as proposals from agents.
        </Typography>
      ) : (
        <>
          <Typography
            sx={{
              fontSize: 8.5,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              mt: 1.6,
              mb: 1,
            }}
          >
            Most pulled
          </Typography>
          <Box
            component="ol"
            sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1 }}
          >
            {summary.mostRecalled.map((entry) => {
              const style = memoryTypeStyle(entry.type, palette.hue);
              const dot = Math.round(5 + Math.min(1, entry.recallCount / 28) * 5);
              return (
                <li key={entry.id}>
                  <Box
                    component={Link}
                    href={`${memoryHref}#entry-${entry.id}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 1,
                      color: 'inherit',
                      textDecoration: 'none',
                      '&:hover': { opacity: 0.7 },
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        width: dot,
                        height: dot,
                        borderRadius: '50%',
                        bgcolor: style.color,
                        flex: '0 0 auto',
                        mt: '5px',
                      }}
                    />
                    <Typography
                      component="span"
                      sx={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: 12.5,
                        lineHeight: 1.35,
                        color: neutral.text,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {entry.title}
                    </Typography>
                    <Typography component="span" sx={{ fontSize: 9.5, color: 'text.secondary', mt: '4px' }}>
                      {entry.recallCount ? `${entry.recallCount}×` : '—'}
                    </Typography>
                  </Box>
                </li>
              );
            })}
          </Box>
        </>
      )}

      <Box
        sx={{
          mt: 1.6,
          pt: 1.4,
          borderTop: `1px solid ${neutral.line}`,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        {summary.pendingCount > 0 && (
          <Typography sx={{ fontSize: 9.5, letterSpacing: '0.05em', color: attention }}>
            {summary.pendingCount} awaiting review
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <ButtonBase
          component={Link}
          href={memoryHref}
          sx={{
            border: `1px solid ${palette.border}`,
            bgcolor: palette.soft,
            color: palette.accent,
            borderRadius: 1,
            px: 1.5,
            py: 0.75,
            fontSize: 11,
            letterSpacing: '0.05em',
            '&:hover': { bgcolor: palette.border },
          }}
        >
          open memory →
        </ButtonBase>
      </Box>
    </Box>
  );
}
