'use client';

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type {
  Announcements,
  CollisionDetection,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import type { Priority } from '@prisma/client';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { CardSignals } from '@/components/card-signals';
import { useDomainPalette } from '@/components/domain-theme';
import { findCard, moveCard, PRIORITIES } from '@/lib/board';
import type { CardSlot, Tiers } from '@/lib/board';
import { oklch, withAlpha } from '@/lib/color';
import { formatDay, plural } from '@/lib/format';
import { neutral } from '@/lib/palette';
import type { BoardNode } from '@/server/services/clusters';
import { useTRPC } from '@/trpc/client';

import { useNodeSelection } from '../use-node-selection';

const LABELS: Record<Priority, string> = { NOW: 'Now', NEXT: 'Next', SOMEDAY: 'Someday' };

/** Droppable ids for whole columns, so a card can land in an empty one or below the last card. */
const COLUMN_PREFIX = 'column:';

/** A pointer has to travel this far before a press becomes a drag, so clicks still open cards. */
const POINTER_SENSOR = { activationConstraint: { distance: 6 } };

/** Space picks a card up and drops it; Enter is left to the button, which opens the card. */
const KEYBOARD_SENSOR = {
  coordinateGetter: sortableKeyboardCoordinates,
  keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
};

const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'To move a card, press space to pick it up, use the arrow keys to move it within or between priorities, then press space to drop it or escape to cancel. Press enter to open the card.',
};

function columnOf(id: UniqueIdentifier): Priority | null {
  const text = String(id);
  return text.startsWith(COLUMN_PREFIX) ? (text.slice(COLUMN_PREFIX.length) as Priority) : null;
}

/**
 * Where a dragged card is. With a pointer, it's whatever is under the pointer:
 * a card if there is one, otherwise the column. Comparing the dragged card's
 * corners instead picks the wrong column when a card from a wide column is
 * dragged into a narrower one. Keyboard drags have no pointer, so they fall
 * back to the nearest corners.
 */
const collisionDetection: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  if (!underPointer.length) return closestCorners(args);
  const cards = underPointer.filter((collision) => !columnOf(collision.id));
  return cards.length ? cards : underPointer;
};

interface DragState {
  id: string;
  /** The board as it looks mid-drag, with the card already in whichever column it's over. */
  tiers: Tiers<BoardNode>;
}

/**
 * The Trello-style view: one column per priority, with checked-off cards
 * tucked below. Cards drag within a column to reorder and across columns to
 * change priority. A drop updates the cached board straight away and saves in
 * the background; if the save fails the card goes back.
 */
export function CardBoard({ domainSlug, clusterSlug }: { domainSlug: string; clusterSlug: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const palette = useDomainPalette();
  const { hue } = palette;
  const { selectedId, select } = useNodeSelection();

  const boardOptions = trpc.cluster.board.queryOptions({ domainSlug, clusterSlug });
  const { data: board } = useSuspenseQuery(boardOptions);
  const move = useMutation(trpc.node.move.mutationOptions());
  const restore = useMutation(trpc.node.restore.mutationOptions());

  const [shelf, setShelf] = useState<'completed' | 'archived' | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  // Drag events can arrive faster than React re-renders, so handlers read the
  // latest drag state from here rather than from a stale render.
  const dragRef = useRef<DragState | null>(null);
  const pendingMoves = useRef(0);

  const updateDrag = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, POINTER_SENSOR),
    useSensor(KeyboardSensor, KEYBOARD_SENSOR),
  );

  const tiers = drag?.tiers ?? board.tiers;
  const activeCard = drag ? PRIORITIES.flatMap((p) => drag.tiers[p]).find((c) => c.id === drag.id) : undefined;

  const titles = useMemo(
    () => new Map(PRIORITIES.flatMap((p) => board.tiers[p]).map((card) => [card.id, card.title])),
    [board.tiers],
  );

  const commitMove = (id: string, slot: CardSlot) => {
    const previous = queryClient.getQueryData(boardOptions.queryKey);
    void queryClient.cancelQueries({ queryKey: boardOptions.queryKey });
    if (previous) {
      queryClient.setQueryData(boardOptions.queryKey, {
        ...previous,
        tiers: moveCard(previous.tiers, id, slot.priority, slot.index),
      });
    }

    pendingMoves.current++;
    move.mutate(
      { id, ...slot },
      {
        onError: () => {
          if (previous) queryClient.setQueryData(boardOptions.queryKey, previous);
          setFailure('That move didn’t save, so the card went back.');
        },
        onSettled: () => {
          pendingMoves.current--;
          // Refetching while another move is still saving would briefly show
          // the board without it, so wait until the last one lands.
          if (pendingMoves.current === 0) {
            void queryClient.invalidateQueries({ queryKey: trpc.cluster.pathKey() });
          }
          void queryClient.invalidateQueries({ queryKey: trpc.node.detail.queryKey({ id }) });
        },
      },
    );
  };

  // Archiving happens in the card panel; the board only brings cards back.
  const restoreCard = (node: BoardNode) => {
    restore.mutate(
      { id: node.id },
      {
        onError: () => setFailure(`${node.title} couldn’t be restored.`),
        onSettled: () => {
          void queryClient.invalidateQueries({ queryKey: trpc.cluster.pathKey() });
          void queryClient.invalidateQueries({ queryKey: trpc.domain.list.queryKey() });
          void queryClient.invalidateQueries({ queryKey: trpc.node.detail.queryKey({ id: node.id }) });
        },
      },
    );
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    updateDrag({ id: String(active.id), tiers: board.tiers });
  };

  // Crossing into another column moves the card there during the drag, so that
  // column opens a gap for it. Reordering within a column is left to sortable's
  // own animation until the drop.
  const handleDragOver = ({ over }: DragOverEvent) => {
    const current = dragRef.current;
    if (!current || !over) return;
    const from = findCard(current.tiers, current.id);
    const overColumn = columnOf(over.id);
    const overCard = overColumn ? null : findCard(current.tiers, String(over.id));
    const to = overColumn ?? overCard?.priority;
    if (!from || !to || to === from.priority) return;
    const index = overCard ? overCard.index : current.tiers[to].length;
    updateDrag({ ...current, tiers: moveCard(current.tiers, current.id, to, index) });
  };

  const handleDragEnd = ({ over }: DragEndEvent) => {
    const current = dragRef.current;
    updateDrag(null);
    if (!current || !over) return;

    const landed = findCard(current.tiers, current.id);
    if (!landed) return;
    const overColumn = columnOf(over.id);
    const overCard = overColumn ? null : findCard(current.tiers, String(over.id));

    let slot: CardSlot = landed;
    if (overCard?.priority === landed.priority) {
      slot = overCard;
    } else if (overColumn === landed.priority) {
      // Dropped in the column's empty space below its cards: the end of the list.
      slot = { priority: landed.priority, index: current.tiers[landed.priority].length - 1 };
    }

    const original = findCard(board.tiers, current.id);
    if (original?.priority === slot.priority && original.index === slot.index) return;
    commitMove(current.id, slot);
  };

  const describe = (id: UniqueIdentifier, within: Tiers<BoardNode>) => {
    const column = columnOf(id);
    if (column) return `the ${LABELS[column]} column`;
    const slot = findCard(within, String(id));
    return slot ? `position ${slot.index + 1} in ${LABELS[slot.priority]}` : 'the board';
  };

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titles.get(String(active.id)) ?? 'card'}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${titles.get(String(active.id)) ?? 'Card'} is over ${describe(over.id, dragRef.current?.tiers ?? board.tiers)}.`
        : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `${titles.get(String(active.id)) ?? 'Card'} dropped at ${describe(over.id, dragRef.current?.tiers ?? board.tiers)}.`
        : `${titles.get(String(active.id)) ?? 'Card'} dropped where it started.`,
    onDragCancel: ({ active }) => `Moving ${titles.get(String(active.id)) ?? 'the card'} was cancelled.`,
  };

  const dotColor = (node: BoardNode) =>
    node.kind === 'TOPIC'
      ? palette.accentBright
      : node.priority === 'NOW'
        ? oklch(0.7, 0.11, hue)
        : oklch(0.42, 0.008, 265);

  const headingColor: Record<Priority, string> = {
    NOW: oklch(0.86, 0.13, hue),
    NEXT: oklch(0.8, 0.05, hue),
    SOMEDAY: neutral.muted,
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        px: 2.75,
        pt: 1.5,
        pb: 2,
      }}
    >
      <Typography sx={{ flex: '0 0 auto', mb: 1.25, fontSize: 10, letterSpacing: '0.06em', color: 'text.secondary' }}>
        Drag cards to reorder or change priority · with a keyboard, focus a card and press space
      </Typography>

      <DndContext
        id="card-board"
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => updateDrag(null)}
        accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
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
          {PRIORITIES.map((priority) => (
            <BoardColumn
              key={priority}
              priority={priority}
              cards={tiers[priority]}
              headingColor={headingColor[priority]}
              selectedId={selectedId}
              dotColor={dotColor}
              onSelect={select}
            />
          ))}
        </Box>

        <DragOverlay>
          {activeCard ? (
            <Box
              sx={{
                ...cardRowSx,
                bgcolor: neutral.raised,
                border: `1px solid ${palette.border}`,
                borderRadius: 1,
                boxShadow: `0 14px 36px ${withAlpha(neutral.rail, 0.7)}`,
                cursor: 'grabbing',
              }}
            >
              <CardFace node={activeCard} selected={false} dotColor={dotColor(activeCard)} />
            </Box>
          ) : null}
        </DragOverlay>
      </DndContext>

      {(board.recentlyCompleted.length > 0 || board.archived.length > 0) && (
        <Box sx={{ flex: '0 0 auto', mt: 2, pt: 1.25, borderTop: `1px solid ${neutral.line}` }}>
          <Box sx={{ display: 'flex', gap: 2.5 }}>
            {board.recentlyCompleted.length > 0 && (
              <ButtonBase
                onClick={() => setShelf((open) => (open === 'completed' ? null : 'completed'))}
                aria-expanded={shelf === 'completed'}
                sx={shelfToggleSx}
              >
                {shelf === 'completed' ? 'Hide' : 'Show'} recently completed · {board.recentlyCompleted.length}
              </ButtonBase>
            )}
            {board.archived.length > 0 && (
              <ButtonBase
                onClick={() => setShelf((open) => (open === 'archived' ? null : 'archived'))}
                aria-expanded={shelf === 'archived'}
                sx={shelfToggleSx}
              >
                {shelf === 'archived' ? 'Hide' : 'Show'} archived · {board.archived.length}
              </ButtonBase>
            )}
          </Box>
          {shelf === 'completed' && board.recentlyCompleted.length > 0 && (
            <ShelfList>
              {board.recentlyCompleted.map((node) => (
                <li key={node.id}>
                  <ButtonBase onClick={() => select(node.id)} sx={{ ...shelfRowSx, width: '100%' }}>
                    <Typography component="span" sx={{ ...shelfTitleSx, textDecoration: 'line-through' }}>
                      {node.title}
                    </Typography>
                    <Typography component="span" sx={shelfDateSx}>
                      {node.completedAt ? formatDay(node.completedAt) : ''}
                    </Typography>
                  </ButtonBase>
                </li>
              ))}
            </ShelfList>
          )}
          {shelf === 'archived' && board.archived.length > 0 && (
            <ShelfList>
              {board.archived.map((node) => (
                <Box component="li" key={node.id} sx={{ ...shelfRowSx, py: 0.5, pr: 0.5 }}>
                  <ButtonBase
                    onClick={() => select(node.id)}
                    sx={{ flex: 1, minWidth: 0, justifyContent: 'space-between', gap: 1.5, py: 0.5, textAlign: 'left' }}
                  >
                    <Typography component="span" sx={shelfTitleSx}>
                      {node.title}
                    </Typography>
                    <Typography component="span" sx={shelfDateSx}>
                      {node.archivedAt ? formatDay(node.archivedAt) : ''}
                    </Typography>
                  </ButtonBase>
                  <ButtonBase
                    onClick={() => restoreCard(node)}
                    disabled={restore.isPending}
                    aria-label={`Restore ${node.title}`}
                    sx={{
                      fontSize: 11,
                      color: neutral.muted,
                      border: `1px solid ${neutral.line}`,
                      borderRadius: 0.75,
                      px: 1.1,
                      py: 0.4,
                      '&:hover': { color: neutral.text, borderColor: neutral.lineStrong },
                    }}
                  >
                    Restore
                  </ButtonBase>
                </Box>
              ))}
            </ShelfList>
          )}
        </Box>
      )}

      <Snackbar
        open={Boolean(failure)}
        autoHideDuration={4000}
        onClose={() => setFailure(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={failure}
      />
    </Box>
  );
}

const shelfToggleSx = {
  fontSize: 9.5,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'text.secondary',
  '&:hover': { color: neutral.text },
} as const;

const shelfRowSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1.5,
  px: 1.5,
  py: 1,
  textAlign: 'left',
  border: `1px solid ${oklch(0.234, 0.01, 265)}`,
  borderRadius: 1,
  bgcolor: oklch(0.149, 0.008, 265),
} as const;

const shelfTitleSx = {
  fontSize: 13.5,
  color: oklch(0.633, 0.008, 265),
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

const shelfDateSx = { fontSize: 9.5, color: 'text.secondary', whiteSpace: 'nowrap' } as const;

/** The cards tucked below the board: recently completed, or archived. */
function ShelfList({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </Box>
  );
}

function BoardColumn({
  priority,
  cards,
  headingColor,
  selectedId,
  dotColor,
  onSelect,
}: {
  priority: Priority;
  cards: BoardNode[];
  headingColor: string;
  selectedId: string | null;
  dotColor: (node: BoardNode) => string;
  onSelect: (id: string) => void;
}) {
  const palette = useDomainPalette();
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_PREFIX}${priority}` });
  const label = LABELS[priority];

  return (
    <Box
      component="section"
      aria-label={label}
      sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, borderLeft: `1px solid ${neutral.line}`, pl: 2 }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25, pb: 1.25, borderBottom: `1px solid ${neutral.line}` }}>
        <Typography
          component="h3"
          sx={{ fontSize: 11.5, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: headingColor }}
        >
          {label}
        </Typography>
        <Typography sx={{ fontSize: 9.5, letterSpacing: '0.06em', color: 'text.secondary' }}>
          {plural(cards.length, 'card')}
        </Typography>
      </Box>
      <SortableContext id={priority} items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        <Box
          component="ul"
          ref={setNodeRef}
          sx={{
            listStyle: 'none',
            m: 0,
            p: 0,
            pr: 1,
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            borderRadius: 1,
            bgcolor: isOver && cards.length === 0 ? withAlpha(palette.soft, 0.5) : 'transparent',
            transition: 'background-color 140ms ease',
          }}
        >
          {cards.map((node) => (
            <SortableCard
              key={node.id}
              node={node}
              selected={node.id === selectedId}
              dotColor={dotColor(node)}
              onSelect={onSelect}
            />
          ))}
          {cards.length === 0 && (
            <Typography
              component="li"
              sx={{ pt: 1.6, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'text.secondary' }}
            >
              Nothing here · drop a card
            </Typography>
          )}
        </Box>
      </SortableContext>
    </Box>
  );
}

const cardRowSx = {
  width: '100%',
  display: 'flex',
  justifyContent: 'flex-start',
  alignItems: 'flex-start',
  textAlign: 'left',
  gap: 1.25,
  py: 1.6,
  pl: 0.25,
  pr: 1,
} as const;

function SortableCard({
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
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
    attributes: { roleDescription: 'card' },
  });

  return (
    <Box
      component="li"
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      sx={{ opacity: isDragging ? 0.35 : 1 }}
    >
      <ButtonBase
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        onClick={() => onSelect(node.id)}
        aria-current={selected ? 'true' : undefined}
        sx={{
          ...cardRowSx,
          borderBottom: `1px solid ${oklch(0.231, 0.01, 265)}`,
          bgcolor: selected ? palette.soft : 'transparent',
          cursor: 'grab',
          touchAction: 'manipulation',
          '&:hover': { bgcolor: selected ? palette.soft : oklch(0.224, 0.012, 265) },
          '&:focus-visible': { outline: `2px solid ${palette.accent}`, outlineOffset: -2 },
        }}
      >
        <CardFace node={node} selected={selected} dotColor={dotColor} />
      </ButtonBase>
    </Box>
  );
}

function CardFace({ node, selected, dotColor }: { node: BoardNode; selected: boolean; dotColor: string }) {
  const badges = [
    node.kind === 'TOPIC' ? 'topic' : null,
    node.noteCount ? plural(node.noteCount, 'note') : null,
    node.attachmentCount ? plural(node.attachmentCount, 'attachment') : null,
    node.memoryCount ? plural(node.memoryCount, 'memory', 'memories') : null,
  ].filter((badge): badge is string => badge !== null);

  return (
    <>
      <Box component="span" sx={{ width: 5, height: 5, borderRadius: '50%', flex: '0 0 auto', mt: '8px', bgcolor: dotColor }} />
      <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          component="span"
          sx={{ display: 'block', fontSize: 14.5, lineHeight: 1.4, color: selected ? neutral.text : oklch(0.934, 0.008, 265) }}
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
      <CardSignals hasText={node.hasText} link={node.link} color={neutral.muted} mt="4px" />
    </>
  );
}
