/** One body in the cloud. Colours are sRGB (`#rrggbb` or `rgba()`), which WebGL can parse. */
export interface CloudOrb {
  id: string;
  label: string;
  /** A small second line under the label, such as a memory count. */
  caption: string | null;
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

/** The fixed body at the centre. */
export interface CloudHub {
  label: string;
  radius: number;
  fill: string;
  border: string;
  labelColor: string;
}
