'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { serif } from '@/app/theme';
import { useDomainPalette } from '@/components/domain-theme';
import { Markdown } from '@/components/markdown';
import { SegmentGroup, segmentSx } from '@/components/segmented';
import { formatTime } from '@/lib/format';
import { neutral } from '@/lib/palette';
import type { JournalDay } from '@/server/services/journal';
import { useTRPC, useTRPCClient } from '@/trpc/client';

import { SectionTitle } from './today-parts';
import type { DayInput } from './today-parts';

/** How long typing has to pause before the journal saves. */
const SAVE_DELAY_MS = 900;

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; at: Date } | { kind: 'failed' };

const paperSx = {
  width: '100%',
  bgcolor: neutral.surface,
  border: `1px solid ${neutral.line}`,
  borderRadius: 1.5,
  px: 2.25,
  py: 2,
} as const;

/**
 * The day's notepad, in markdown. It saves itself a moment after typing stops,
 * and on the way out. `[[A card or cluster]]` links the day to it, so the day
 * turns up on that cluster's memory timeline.
 */
export function JournalPad({
  input,
  journal,
  startReading,
}: {
  input: DayInput;
  journal: JournalDay;
  startReading: boolean;
}) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const palette = useDomainPalette();
  const { day, timeZone } = input;

  const [text, setText] = useState(journal.body);
  const [mode, setMode] = useState<'write' | 'read'>(startReading ? 'read' : 'write');
  const [save, setSave] = useState<SaveState>(
    journal.updatedAt ? { kind: 'saved', at: journal.updatedAt } : { kind: 'idle' },
  );

  // What the server holds, what's waiting to go, and whether a save is out.
  const savedBody = useRef(journal.body);
  const pendingBody = useRef<string | null>(null);
  const saving = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    if (saving.current) return;
    saving.current = true;
    let body = pendingBody.current;
    try {
      while (body !== null) {
        pendingBody.current = null;
        if (body !== savedBody.current) {
          setSave({ kind: 'saving' });
          const result = await trpcClient.journal.save.mutate({ day, body });
          savedBody.current = body;
          queryClient.setQueryData(trpc.today.day.queryKey({ day, timeZone }), (old) => old && { ...old, journal: result });
          // Its [[links]] decide which cluster timelines it's on.
          void queryClient.invalidateQueries({ queryKey: trpc.memory.pathKey() });
          setSave(result.updatedAt ? { kind: 'saved', at: result.updatedAt } : { kind: 'idle' });
        }
        // Typing may have carried on while that save was out.
        body = pendingBody.current;
      }
    } catch {
      // Keep the text for the next attempt, which the next keystroke starts.
      pendingBody.current ??= body;
      setSave({ kind: 'failed' });
    } finally {
      saving.current = false;
    }
  }, [day, timeZone, queryClient, trpc, trpcClient]);

  // Save whatever is waiting when leaving the day or the page.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener('pagehide', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      void flush();
    };
  }, [flush]);

  const change = (value: string) => {
    setText(value);
    pendingBody.current = value;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
  };

  const status =
    save.kind === 'saving'
      ? 'saving…'
      : save.kind === 'failed'
        ? 'didn’t save — keep typing to try again'
        : save.kind === 'saved'
          ? `saved ${formatTime(save.at)}`
          : undefined;

  return (
    <Box component="section" aria-labelledby="journal-heading" sx={{ minWidth: 0 }}>
      <SectionTitle
        id="journal-heading"
        title="Journal"
        meta={status}
        action={
          <SegmentGroup label="Journal view">
            {(['write', 'read'] as const).map((value) => (
              <ButtonBase
                key={value}
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                sx={segmentSx(mode === value, palette)}
              >
                {value === 'write' ? 'Write' : 'Read'}
              </ButtonBase>
            ))}
          </SegmentGroup>
        }
      />
      {mode === 'write' ? (
        <InputBase
          value={text}
          onChange={(event) => change(event.target.value)}
          multiline
          minRows={16}
          placeholder={
            'What’s on your mind?\n\nMarkdown works. [[A card or cluster]] links this day to it, so the day turns up on that cluster’s timeline.'
          }
          slotProps={{ input: { 'aria-label': 'Journal', maxLength: 200_000 } }}
          sx={{
            ...paperSx,
            alignItems: 'flex-start',
            fontFamily: serif,
            fontSize: 16.5,
            lineHeight: 1.65,
            color: neutral.text,
            transition: 'border-color 140ms ease',
            '&.Mui-focused': { borderColor: palette.border },
          }}
        />
      ) : (
        <Box sx={{ ...paperSx, minHeight: 200 }}>
          {text.trim() ? (
            <Markdown>{text}</Markdown>
          ) : (
            <Typography sx={{ fontSize: 13.5, color: 'text.secondary' }}>Nothing written this day.</Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
