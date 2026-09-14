import type { AuthorKind, MemoryEntryType, MemoryRevisionAction } from '@prisma/client';

import { oklch } from './color';
import { attention, rotateHue } from './palette';

export interface MemoryTypeStyle {
  label: string;
  color: string;
  /** Drawn as an outline rather than a solid marker. */
  hollow: boolean;
  /** Drawn square rather than round. */
  square: boolean;
}

/**
 * How each kind of entry reads at a glance. Decisions are the domain's own
 * colour and solid; open questions are hollow amber, like everything else
 * waiting on me; write-ups are hollow so single facts stand out beside them.
 */
export function memoryTypeStyle(type: MemoryEntryType, hue: number): MemoryTypeStyle {
  switch (type) {
    case 'DECISION':
      return { label: 'Decision', color: oklch(0.8, 0.14, hue), hollow: false, square: false };
    case 'FACT':
      return { label: 'Fact', color: oklch(0.72, 0.06, hue), hollow: false, square: false };
    case 'PREFERENCE':
      return {
        label: 'Preference',
        color: oklch(0.78, 0.1, rotateHue(hue, 60)),
        hollow: false,
        square: false,
      };
    case 'PROCEDURE':
      return { label: 'Procedure', color: oklch(0.74, 0.012, 265), hollow: false, square: true };
    case 'REFERENCE':
      return { label: 'Reference', color: oklch(0.72, 0.012, 265), hollow: true, square: true };
    case 'QUESTION':
      return { label: 'Open question', color: attention, hollow: true, square: false };
    case 'SYNTHESIS':
      return {
        label: 'Write-up',
        color: oklch(0.78, 0.08, rotateHue(hue, -40)),
        hollow: true,
        square: false,
      };
  }
}

const ACTION_LABELS: Record<MemoryRevisionAction, string> = {
  CREATED: 'Created',
  UPDATED: 'Updated',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  SUPERSEDED: 'Superseded',
  ARCHIVED: 'Archived',
  RESTORED: 'Restored',
};

export function actionLabel(action: MemoryRevisionAction): string {
  return ACTION_LABELS[action];
}

/** "you" for my own writing, otherwise the agent's name when it gave one. */
export function authorLabel(author: AuthorKind, agent: string | null = null): string {
  return author === 'USER' ? 'you' : (agent ?? 'agent');
}
