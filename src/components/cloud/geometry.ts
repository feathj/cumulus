/** Stable pseudo-random 0–1 from a string (FNV-1a), so layouts don't reshuffle between renders. */
export function hash01(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
}

export interface RingSpec {
  count: number;
  orbRadius: number;
}

/**
 * Orbit radius for each ring, inside out: far enough to clear everything
 * inside it, and wide enough around that its orbs fit side by side. An empty
 * ring takes up no room.
 */
export function ringRadii(hubRadius: number, rings: RingSpec[], gap: number): number[] {
  let innerEdge = hubRadius;
  return rings.map(({ count, orbRadius }) => {
    const clear = innerEdge + orbRadius + gap;
    const fit = (count * (2 * orbRadius + gap)) / (2 * Math.PI);
    const radius = Math.max(clear, fit);
    if (count > 0) innerEdge = radius + orbRadius;
    return radius;
  });
}

/** One ring holding orbs of different sizes. */
export function singleRingRadius(hubRadius: number, orbRadii: number[], gap: number): number {
  if (!orbRadii.length) return hubRadius;
  const circumference = orbRadii.reduce((total, radius) => total + 2 * radius + gap, 0);
  return Math.max(hubRadius + Math.max(...orbRadii) + gap, circumference / (2 * Math.PI));
}

/** Shrinks orbs in a crowded tier so a big cluster doesn't sprawl off screen. */
export function orbRadiusForTier(baseRadius: number, count: number): number {
  const scale = Math.sqrt(16 / Math.max(1, count));
  return baseRadius * Math.min(1, Math.max(0.62, scale));
}

/**
 * Stretch factors that turn circular orbits into ellipses matching the
 * viewport's shape, so a wide screen isn't wasted. Their product is 1, so the
 * area of a ring stays the same.
 */
export function ellipseAxes(width: number, height: number): { kx: number; ky: number } {
  const aspect = height > 0 ? Math.min(1.9, Math.max(0.75, width / height)) : 1;
  return { kx: Math.sqrt(aspect), ky: 1 / Math.sqrt(aspect) };
}
