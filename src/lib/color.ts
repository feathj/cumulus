/**
 * The design is specified in OKLCH, but Sigma's WebGL renderer and MUI's
 * palette helpers only parse sRGB. These convert via OKLab, using Björn
 * Ottosson's reference matrices, and clamp anything out of gamut.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

function toByte(linear: number): number {
  const encoded = linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(1, Math.max(0, encoded)) * 255);
}

/** Lightness 0–1, chroma roughly 0–0.4, hue in degrees. */
export function oklchToRgb(lightness: number, chroma: number, hue: number): Rgb {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return {
    r: toByte(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: toByte(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: toByte(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

const hex = (n: number) => n.toString(16).padStart(2, '0');

/** `#rrggbb` for an OKLCH colour. */
export function oklch(lightness: number, chroma: number, hue: number): string {
  const { r, g, b } = oklchToRgb(lightness, chroma, hue);
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** `rgba(...)` for an OKLCH colour with transparency. */
export function oklcha(lightness: number, chroma: number, hue: number, alpha: number): string {
  const { r, g, b } = oklchToRgb(lightness, chroma, hue);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Adds an alpha channel to a `#rrggbb` colour, giving `#rrggbbaa`. */
export function withAlpha(color: string, alpha: number): string {
  return `${color}${hex(Math.round(Math.min(1, Math.max(0, alpha)) * 255))}`;
}

/**
 * Resolves a translucent `rgba()` colour against an opaque `#rrggbb`
 * background, giving the solid colour it would appear as. Sigma's WebGL
 * programs render translucent colours far brighter than a browser would, so
 * cloud colours are flattened before they reach it. Anything that isn't
 * `rgba()` passes through untouched.
 */
export function flattenColor(color: string, background: string): string {
  const rgba = /^rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)$/.exec(color);
  const under = /^#([0-9a-f]{6})$/i.exec(background)?.[1];
  if (!rgba || !under) return color;

  const alpha = Math.min(1, Math.max(0, Number(rgba[4])));
  const base = parseInt(under, 16);
  const mix = (channel: string | undefined, beneath: number) =>
    hex(Math.round(Number(channel) * alpha + beneath * (1 - alpha)));

  return `#${mix(rgba[1], (base >> 16) & 255)}${mix(rgba[2], (base >> 8) & 255)}${mix(rgba[3], base & 255)}`;
}
