import type { LinkKind } from './card-links';
import { oklch } from './color';

/** Small marks saying a card holds more than its title. */
export type CardIconName = 'text' | LinkKind;

export interface CardIcon {
  /** What the icon means, for screen readers. */
  label: string;
  /**
   * SVG path data on a 24×24 grid. Plain paths rather than an icon font or
   * component, so the cloud's label canvas can draw them with `Path2D` too.
   */
  path: string;
  /** Cut inner shapes out of the outer one (the play button) instead of filling them. */
  evenOdd: boolean;
  /** A fixed colour; null takes the colour of the text around it. */
  color: string | null;
}

export const CARD_ICONS: Record<CardIconName, CardIcon> = {
  text: {
    label: 'Has a description',
    path: 'M4 5h16v2H4zM4 9h16v2H4zM4 13h16v2H4zM4 17h10v2H4z',
    evenOdd: false,
    color: null,
  },
  link: {
    label: 'Has a link',
    path: 'M10.6 7H7a5 5 0 0 0 0 10h3.6v-2H7a3 3 0 0 1 0-6h3.6zM13.4 7v2H17a3 3 0 0 1 0 6h-3.6v2H17a5 5 0 0 0 0-10zM8 11h8v2H8z',
    evenOdd: false,
    color: null,
  },
  youtube: {
    label: 'Has a YouTube link',
    path: 'M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3z',
    evenOdd: true,
    // YouTube red, softened to sit on the dark ground.
    color: oklch(0.64, 0.2, 27),
  },
};

/** The icons a card shows, in display order: its description, then its link. */
export function cardIcons({ hasText, link }: { hasText: boolean; link: LinkKind | null }): CardIconName[] {
  return [...(hasText ? (['text'] as const) : []), ...(link ? [link] : [])];
}
