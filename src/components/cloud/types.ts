import type { CardIconName } from '@/lib/icons';

/** One body in the cloud. Colours are sRGB (`#rrggbb` or `rgba()`), which WebGL can parse. */
export interface CloudOrb {
  id: string;
  label: string;
  /** A small second line under the label, such as a memory count. */
  caption: string | null;
  /** Icons in a row beneath the label, drawn in the caption colour unless they have their own. */
  icons?: CardIconName[];
  /** Cards to drift inside the orb, a few at a time, rotating through the list. */
  cells?: CloudCell[];
  /** In graph units; at zoom 1 roughly pixels. */
  radius: number;
  /** Distance from the hub the orb orbits at, before the ellipse stretch. */
  ring: number;
  /** Which way it drifts around the hub. */
  direction: 1 | -1;
  fill: string;
  border: string;
  labelColor: string;
  captionColor: string;
  serif: boolean;
  bold: boolean;
}

/** A card drifting inside an orb. Decorative only: cells can't be hovered or clicked. */
export interface CloudCell {
  id: string;
  label: string;
  /**
   * Relative size, where 1 is a standard cell. Bigger cells are drawn brighter
   * too, so what matters most stands out.
   */
  scale: number;
}

/** The fixed body at the centre. */
export interface CloudHub {
  label: string;
  radius: number;
  fill: string;
  border: string;
  labelColor: string;
}

/**
 * How orbs move when nothing's touching them. `drift` turns each ring slowly,
 * for rings of cards. `float` keeps each orb near its own spot and lets it
 * meander there, for a single ring of clusters that would jam if it turned.
 */
export type CloudMotion = 'drift' | 'float';
