'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { useDomainPalette } from '@/components/domain-theme';
import { oklch } from '@/lib/color';
import { formatDay, plural } from '@/lib/format';
import { neutral } from '@/lib/palette';
import type { BoardNode } from '@/server/services/clusters';
import { useTRPC } from '@/trpc/client';

import { useNodeSelection } from '../use-node-selection';

const COLUMNS = [
  { priority: 'NOW', label: 'Now' },
  { priority: 'NEXT', label: 'Next' },
  { priority: 'SOMEDAY', label: 'Someday' },
] as const;

/** The Trello-style view: one column per priority, with checked-off cards tucked below. */
export function CardBoard({ domainSlug, clusterSlug }: { domainSlug: string; clusterSlug: string }) {
  const trpc = useTRPC();
  const palette = useDomainPalette();
  const { hue } = palette;
  const { selectedId, select } = useNodeSelection();
  const { data: board } = useSuspenseQuery(
    trpc.cluster.board.queryOptions({ domainSlug, clusterSlug }),
  );
  const [showCompleted, setShowCompleted] = useState(false);

  const headingColor = {
    NOW: oklch(0.86, 0.13, hue),
    NEXT: oklch(0.8, 0.05, hue),
    SOMEDAY: neutral.muted,
  };
  const dotColor = (node: BoardNode) =>
    node.kind === 'TOPIC'
      ? palette.accentBright
      : node.priority === 'NOW'
        ? oklch(0.7, 0.11, hue)
        : oklch(0.42, 0.008, 265);

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        px: 2.75,
        pt: 2.25,
        pb: 2,
      }}
    >
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(228px, 1fr))',
          gap: 3.75,
          overflowX: 'auto',
        }}
      >
        {COLUMNS.map(({ priority, label }) => {
          const cards = board.tiers[priority];
          return (
            <Box
              key={priority}
              component="section"
              aria-label={label}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                borderLeft: `1px solid ${neutral.line}`,
                pl: 2,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 1.25,
                  pb: 1.25,
                  borderBottom: `1px solid ${neutral.line}`,
                }}
              >
                <Typography
                  component="h3"
                  sx={{
                    fontSize: 11.5,
                    fontWeight: 500,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: headingColor[priority],
                  }}
                >
                  {label}
                </Typography>
                <Typography sx={{ fontSize: 9.5, letterSpacing: '0.06em', color: 'text.secondary' }}>
                  {plural(cards.length, 'card')}
                </Typography>
              </Box>
              <Box
                component="ul"
                sx={{ listStyle: 'none', m: 0, p: 0, pr: 1, flex: 1, minHeight: 0, overflowY: 'auto' }}
              >
                {cards.map((node) => (
                  <li key={node.id}>
                    <CardRow
                      node={node}
                      selected={node.id === selectedId}
                      dotColor={dotColor(node)}
                      onSelect={select}
                    />
                  </li>
                ))}
                {cards.length === 0 && (
                  <Typography
                    component="li"
                    sx={{
                      pt: 1.6,
                      fontSize: 9.5,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'text.secondary',
                    }}
                  >
                    Nothing here
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {board.recentlyCompleted.length > 0 && (
        <Box sx={{ flex: '0 0 auto', mt: 2, pt: 1.25, borderTop: `1px solid ${neutral.line}` }}>
          <ButtonBase
            onClick={() => setShowCompleted((shown) => !shown)}
            aria-expanded={showCompleted}
            sx={{
              fontSize: 9.5,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              '&:hover': { color: neutral.text },
            }}
          >
            {showCompleted ? 'Hide' : 'Show'} recently completed · {board.recentlyCompleted.length}
          </ButtonBase>
          {showCompleted && (
            <Box
              component="ul"
              sx={{
                listStyle: 'none',
                m: 0,
                mt: 1,
                p: 0,
                maxHeight: 180,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 0.75,
              }}
            >
              {board.recentlyCompleted.map((node) => (
                <li key={node.id}>
                  <ButtonBase
                    onClick={() => select(node.id)}
                    sx={{
                      width: '100%',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      px: 1.5,
                      py: 1,
                      textAlign: 'left',
                      border: `1px solid ${oklch(0.234, 0.01, 265)}`,
                      borderRadius: 1,
                      bgcolor: oklch(0.149, 0.008, 265),
                    }}
                  >
                    <Typography
                      component="span"
                      sx={{ fontSize: 13.5, color: oklch(0.633, 0.008, 265), textDecoration: 'line-through' }}
                    >
                      {node.title}
                    </Typography>
                    <Typography
                      component="span"
                      sx={{ fontSize: 9.5, color: 'text.secondary', whiteSpace: 'nowrap' }}
                    >
                      {node.completedAt ? formatDay(node.completedAt) : ''}
                    </Typography>
                  </ButtonBase>
                </li>
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

function CardRow({
  node,
  selected,
  dotColor,
  onSelect,
}: {
  node: BoardNode;
  selected: boolean;
  dotColor: string;
  onSelect: (id: string) => void;
}) {
  const palette = useDomainPalette();
  const badges = [
    node.kind === 'TOPIC' ? 'topic' : null,
    node.noteCount ? plural(node.noteCount, 'note') : null,
    node.attachmentCount ? plural(node.attachmentCount, 'attachment') : null,
    node.memoryCount ? plural(node.memoryCount, 'memory', 'memories') : null,
  ].filter((badge): badge is string => badge !== null);

  return (
    <ButtonBase
      onClick={() => onSelect(node.id)}
      aria-current={selected ? 'true' : undefined}
      sx={{
        width: '100%',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        textAlign: 'left',
        gap: 1.25,
        py: 1.6,
        pl: 0.25,
        pr: 1,
        borderBottom: `1px solid ${oklch(0.231, 0.01, 265)}`,
        bgcolor: selected ? palette.soft : 'transparent',
        '&:hover': { bgcolor: selected ? palette.soft : oklch(0.224, 0.012, 265) },
      }}
    >
      <Box
        component="span"
        sx={{ width: 5, height: 5, borderRadius: '50%', flex: '0 0 auto', mt: '8px', bgcolor: dotColor }}
      />
      <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          component="span"
          sx={{
            display: 'block',
            fontSize: 14.5,
            lineHeight: 1.4,
            color: selected ? neutral.text : oklch(0.934, 0.008, 265),
          }}
        >
          {node.title}
        </Typography>
        {badges.length > 0 && (
          <Typography
            component="span"
            sx={{ display: 'block', mt: 0.5, fontSize: 9.5, letterSpacing: '0.06em', color: 'text.secondary' }}
          >
            {badges.join(' · ')}
          </Typography>
        )}
      </Box>
    </ButtonBase>
  );
}
