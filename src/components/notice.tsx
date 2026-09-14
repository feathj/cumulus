'use client';

import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';
import Link from 'next/link';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type NoticeAction = { label: string; href: string } | { label: string; onClick: () => void };

export type ShowNotice = (message: string, action?: NoticeAction) => void;

interface Notice {
  /** Changes with every notice, so a new one restarts the timer even if the text repeats. */
  id: number;
  message: string;
  action?: NoticeAction;
}

const NoticeContext = createContext<ShowNotice | null>(null);

/**
 * One snackbar for everything inside a domain. A notice outlives whatever
 * showed it, so Undo still works after a drawer closes or the page moves on,
 * and a new notice replaces the last rather than stacking.
 */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const nextId = useRef(0);

  const show = useCallback<ShowNotice>((message, action) => {
    nextId.current += 1;
    setNotice({ id: nextId.current, message, ...(action ? { action } : {}) });
  }, []);
  const close = useCallback(() => setNotice(null), []);
  const action = notice?.action;

  return (
    <NoticeContext.Provider value={show}>
      {children}
      <Snackbar
        key={notice?.id}
        open={Boolean(notice)}
        autoHideDuration={6000}
        onClose={(_event, reason) => {
          if (reason !== 'clickaway') close();
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        message={notice?.message}
        action={
          action ? (
            'href' in action ? (
              <Button component={Link} href={action.href} size="small" onClick={close}>
                {action.label}
              </Button>
            ) : (
              <Button
                size="small"
                onClick={() => {
                  action.onClick();
                  close();
                }}
              >
                {action.label}
              </Button>
            )
          ) : undefined
        }
      />
    </NoticeContext.Provider>
  );
}

/** Shows a short confirmation, optionally with an action like Undo, in the nearest NoticeProvider. */
export function useShowNotice(): ShowNotice {
  const show = useContext(NoticeContext);
  if (!show) throw new Error('useShowNotice must be used inside a NoticeProvider.');
  return show;
}
