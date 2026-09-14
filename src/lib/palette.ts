import { oklch } from './color';

/** The mockup's neutral greys, all on a cool 265° hue. */
export const neutral = {
  canvas: oklch(0.129, 0.012, 265),
  canvasGlow: oklch(0.196, 0.02, 265),
  rail: oklch(0.115, 0.012, 265),
  surface: oklch(0.169, 0.013, 265),
  raised: oklch(0.189, 0.014, 265),
  code: oklch(0.142, 0.01, 265),
  line: oklch(0.249, 0.014, 265),
  lineStrong: oklch(0.292, 0.016, 265),
  text: oklch(0.979, 0.008, 265),
  textSoft: oklch(0.846, 0.01, 265),
  muted: oklch(0.62, 0.012, 265),
} as const;

/** Amber, for anything waiting on me: pending review, open questions. */
export const attention = oklch(0.8, 0.13, 62);

/** The colours a domain derives from its single `themeHue`. */
export interface DomainPalette {
  hue: number;
  /** Titles, active tabs, links. */
  accent: string;
  /** Glowing dots. */
  accentBright: string;
  /** Borders on accented controls. */
  border: string;
  /** Fill behind accented controls. */
  soft: string;
}

export function domainPalette(hue: number): DomainPalette {
  return {
    hue,
    accent: oklch(0.82, 0.135, hue),
    accentBright: oklch(0.82, 0.15, hue),
    border: oklch(0.43, 0.095, hue),
    soft: oklch(0.28, 0.055, hue),
  };
}

/** Shifts a hue around the wheel, staying within 0–359. */
export function rotateHue(hue: number, degrees: number): number {
  return (((hue + degrees) % 360) + 360) % 360;
}
