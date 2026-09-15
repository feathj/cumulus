'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import InputBase from '@mui/material/InputBase';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

import { useDomainPalette } from '@/components/domain-theme';
import { NoticeProvider, useShowNotice } from '@/components/notice';
import { SegmentGroup, segmentSx } from '@/components/segmented';
import { oklch } from '@/lib/color';
import { plural } from '@/lib/format';
import { neutral } from '@/lib/palette';
import { cloudPath, inboxPath, todayPath } from '@/lib/routes';
import { useTRPC } from '@/trpc/client';

const SECTIONS = [
  { label: 'Today', href: todayPath },
  { label: 'Inbox', href: inboxPath },
  { label: 'Cloud', href: cloudPath },
] as const;

/** Everything in the app sits in this frame: the section tabs and capture box above, a section below. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <NoticeProvider>
      <Box
        sx={{
          height: '100dvh',
          minHeight: 420,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: neutral.text,
          background: `radial-gradient(120% 90% at 50% 0%, ${neutral.canvasGlow} 0%, ${neutral.canvas} 62%)`,
        }}
      >
        <AppHeader />
        <Box component="main" sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {children}
        </Box>
      </Box>
    </NoticeProvider>
  );
}

function AppHeader() {
  const trpc = useTRPC();
  const pathname = usePathname();
  const palette = useDomainPalette();
  const { data: inboxCount } = useSuspenseQuery(trpc.inbox.count.queryOptions());

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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <ButtonBase
          component={Link}
          href={cloudPath}
          sx={{
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: '0.24em',
            color: neutral.textSoft,
            borderRadius: 0.5,
            px: 0.5,
            '&:hover': { color: neutral.text },
          }}
        >
          CUMULUS
        </ButtonBase>
        <Box sx={{ flex: 1 }} />
        <SegmentGroup label="Sections">
          {SECTIONS.map((section) => {
            const active = pathname === section.href || pathname.startsWith(`${section.href}/`);
            const isInbox = section.href === inboxPath;
            return (
              <ButtonBase
                key={section.href}
                component={Link}
                href={section.href}
                aria-current={active ? 'page' : undefined}
                aria-label={isInbox ? `Inbox, ${plural(inboxCount, 'idea')} waiting` : undefined}
                sx={{ ...segmentSx(active, palette), fontSize: 12.5, px: 1.8, py: 0.85, gap: 0.9 }}
              >
                {section.label}
                {isInbox && inboxCount > 0 && (
                  <Box
                    component="span"
                    aria-hidden
                    sx={{
                      fontSize: 10,
                      lineHeight: 1.4,
                      px: 0.75,
                      borderRadius: 0.5,
                      bgcolor: active ? oklch(0.38, 0.075, palette.hue) : neutral.line,
                      color: active ? oklch(0.95, 0.03, palette.hue) : neutral.textSoft,
                    }}
                  >
                    {inboxCount}
                  </Box>
                )}
              </ButtonBase>
            );
          })}
        </SegmentGroup>
      </Box>
      <CaptureBar />
    </Box>
  );
}

/**
 * The capture box, everywhere: type a thought, press Enter, and it's in the
 * inbox without deciding anything about it, not even its domain. `/` focuses
 * it from anywhere that isn't already a text field.
 */
function CaptureBar() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const palette = useDomainPalette();
  const show = useShowNotice();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
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
      { text: value },
      {
        onSuccess: () => show('Caught. It’s in the inbox.', { label: 'Open inbox', href: inboxPath }),
        onError: () => {
          setText((current) => current || value);
          show('That didn’t save. Your text is back in the box.');
        },
        onSettled: () => {
          void queryClient.invalidateQueries({ queryKey: trpc.inbox.pathKey() });
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
