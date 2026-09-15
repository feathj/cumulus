'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { useDomainPalette } from '@/components/domain-theme';
import { useShowNotice } from '@/components/notice';
import type { ShowNotice } from '@/components/notice';
import { neutral } from '@/lib/palette';
import type { RoutineView } from '@/server/services/routines';
import { useTRPC, useTRPCClient } from '@/trpc/client';

import { quietButtonSx, SectionTitle } from './today-parts';
import type { DayInput } from './today-parts';

/**
 * The routines, as chips to check off for the day. Edit turns them into a list
 * for adding, renaming, reordering and retiring, right here.
 */
export function RoutineStrip({ input, routines }: { input: DayInput; routines: RoutineView[] }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const palette = useDomainPalette();
  const show = useShowNotice();
  const [editing, setEditing] = useState(false);
  const dayQueryKey = trpc.today.day.queryKey(input);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.today.pathKey() });
  };

  // The chip flips straight away; the server catches up.
  const check = useMutation(
    trpc.routine.check.mutationOptions({
      onMutate: async ({ id, checked }) => {
        await queryClient.cancelQueries({ queryKey: dayQueryKey });
        queryClient.setQueryData(
          dayQueryKey,
          (old) =>
            old && {
              ...old,
              routines: old.routines.map((routine) => (routine.id === id ? { ...routine, checked } : routine)),
            },
        );
      },
      onError: () => show('That didn’t save.'),
      onSettled: refresh,
    }),
  );

  const done = routines.filter((routine) => routine.checked).length;
  const meta = !routines.length
    ? undefined
    : done === routines.length
      ? 'all done'
      : `${done} of ${routines.length}`;

  return (
    <Box component="section" aria-labelledby="routines-heading" sx={{ mt: 3.5 }}>
      <SectionTitle
        id="routines-heading"
        title="Routines"
        meta={meta}
        action={
          <ButtonBase onClick={() => setEditing((open) => !open)} aria-pressed={editing} sx={quietButtonSx}>
            {editing ? 'Done' : 'Edit'}
          </ButtonBase>
        }
      />
      {editing ? (
        <RoutineEditor routines={routines} onNotice={show} onChange={refresh} />
      ) : routines.length > 0 ? (
        <Box
          component="ul"
          aria-label="Routines for the day"
          sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexWrap: 'wrap', gap: 1 }}
        >
          {routines.map((routine) => (
            <li key={routine.id}>
              <RoutineChip
                routine={routine}
                onToggle={() => check.mutate({ id: routine.id, day: input.day, checked: !routine.checked })}
              />
            </li>
          ))}
        </Box>
      ) : (
        <Typography sx={{ fontSize: 13.5, lineHeight: 1.55, color: 'text.secondary' }}>
          No routines yet: the small things you mean to do every day, like exercise or meditating.{' '}
          <ButtonBase
            onClick={() => setEditing(true)}
            sx={{ font: 'inherit', verticalAlign: 'baseline', color: palette.accent, '&:hover': { textDecoration: 'underline' } }}
          >
            Add one
          </ButtonBase>
        </Typography>
      )}
    </Box>
  );
}

function RoutineChip({ routine, onToggle }: { routine: RoutineView; onToggle: () => void }) {
  const palette = useDomainPalette();
  const { checked } = routine;

  return (
    <ButtonBase
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        border: `1px solid ${checked ? palette.border : neutral.lineStrong}`,
        bgcolor: checked ? palette.soft : neutral.surface,
        color: checked ? palette.accent : neutral.textSoft,
        borderRadius: 5,
        pl: 0.9,
        pr: 1.75,
        py: 0.7,
        fontSize: 13.5,
        transition: 'background-color 160ms ease, border-color 160ms ease, color 160ms ease',
        '&:hover': { borderColor: palette.border },
      }}
    >
      <Box
        component="span"
        aria-hidden
        sx={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          fontSize: 11,
          lineHeight: 1,
          border: `1.5px solid ${checked ? palette.accent : neutral.muted}`,
          bgcolor: checked ? palette.accent : 'transparent',
          color: neutral.canvas,
          transition: 'background-color 160ms ease',
        }}
      >
        {checked ? '✓' : ''}
      </Box>
      {routine.title}
    </ButtonBase>
  );
}

function RoutineEditor({
  routines,
  onNotice,
  onChange,
}: {
  routines: RoutineView[];
  onNotice: ShowNotice;
  onChange: () => void;
}) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const create = useMutation(trpc.routine.create.mutationOptions({ onSettled: onChange }));
  const rename = useMutation(trpc.routine.rename.mutationOptions({ onSettled: onChange }));
  const move = useMutation(trpc.routine.move.mutationOptions({ onSettled: onChange }));
  const archive = useMutation(trpc.routine.archive.mutationOptions({ onSettled: onChange }));
  const [draft, setDraft] = useState('');
  const busy = move.isPending || archive.isPending;

  const add = (event: FormEvent) => {
    event.preventDefault();
    const title = draft.trim();
    if (!title) return;
    create.mutate({ title }, { onSuccess: () => setDraft(''), onError: () => onNotice('That routine didn’t save.') });
  };

  // Undo can come after editing is done, so it calls the client directly
  // instead of through a mutation hook tied to this editor.
  const retire = (routine: RoutineView) =>
    archive.mutate(
      { id: routine.id },
      {
        onSuccess: () =>
          onNotice(`Retired ${routine.title}. The days you did it are kept.`, {
            label: 'Undo',
            onClick: () => {
              trpcClient.routine.restore
                .mutate({ id: routine.id })
                .then(onChange, () => onNotice(`${routine.title} couldn’t be brought back.`));
            },
          }),
        onError: () => onNotice(`${routine.title} couldn’t be retired.`),
      },
    );

  return (
    <Box sx={{ border: `1px solid ${neutral.line}`, borderRadius: 1.5, bgcolor: neutral.surface, px: 1.5, py: 1.25 }}>
      {routines.length > 0 && (
        <Box
          component="ol"
          aria-label="Edit routines"
          sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}
        >
          {routines.map((routine, index) => (
            <RoutineRow
              // The title is in the key so a saved rename resets the field.
              key={`${routine.id}:${routine.title}`}
              routine={routine}
              first={index === 0}
              last={index === routines.length - 1}
              busy={busy}
              onRename={(title) =>
                rename.mutate({ id: routine.id, title }, { onError: () => onNotice('That name didn’t save.') })
              }
              onMove={(offset) =>
                move.mutate({ id: routine.id, index: index + offset }, { onError: () => onNotice('That didn’t move.') })
              }
              onRetire={() => retire(routine)}
            />
          ))}
        </Box>
      )}
      <Box
        component="form"
        onSubmit={add}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: routines.length ? 1.25 : 0 }}
      >
        <InputBase
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add a routine: exercise, meditate, read…"
          autoFocus={routines.length === 0}
          slotProps={{ input: { 'aria-label': 'New routine', maxLength: 120 } }}
          sx={{
            flex: 1,
            fontSize: 14,
            color: neutral.text,
            px: 1,
            py: 0.4,
            border: `1px solid ${neutral.line}`,
            borderRadius: 1,
            '&.Mui-focused': { borderColor: neutral.lineStrong },
          }}
        />
        <ButtonBase type="submit" disabled={!draft.trim() || create.isPending} sx={quietButtonSx}>
          Add
        </ButtonBase>
      </Box>
    </Box>
  );
}

const arrowButtonSx = {
  width: 28,
  height: 28,
  borderRadius: 1,
  fontSize: 14,
  color: neutral.muted,
  '&:hover': { color: neutral.text, bgcolor: neutral.raised },
  '&.Mui-disabled': { opacity: 0.3 },
} as const;

function RoutineRow({
  routine,
  first,
  last,
  busy,
  onRename,
  onMove,
  onRetire,
}: {
  routine: RoutineView;
  first: boolean;
  last: boolean;
  busy: boolean;
  onRename: (title: string) => void;
  onMove: (offset: -1 | 1) => void;
  onRetire: () => void;
}) {
  const [title, setTitle] = useState(routine.title);

  const commit = () => {
    const name = title.trim();
    if (!name) setTitle(routine.title);
    else if (name !== routine.title) onRename(name);
  };

  return (
    <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <InputBase
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            setTitle(routine.title);
          }
        }}
        slotProps={{ input: { 'aria-label': `Rename ${routine.title}`, maxLength: 120 } }}
        sx={{
          flex: 1,
          fontSize: 14,
          color: neutral.text,
          px: 1,
          py: 0.25,
          borderRadius: 1,
          '&:hover, &.Mui-focused': { bgcolor: neutral.raised },
        }}
      />
      <ButtonBase aria-label={`Move ${routine.title} up`} disabled={first || busy} onClick={() => onMove(-1)} sx={arrowButtonSx}>
        ↑
      </ButtonBase>
      <ButtonBase aria-label={`Move ${routine.title} down`} disabled={last || busy} onClick={() => onMove(1)} sx={arrowButtonSx}>
        ↓
      </ButtonBase>
      <ButtonBase onClick={onRetire} disabled={busy} sx={{ ...quietButtonSx, ml: 0.5 }}>
        Retire
      </ButtonBase>
    </Box>
  );
}
