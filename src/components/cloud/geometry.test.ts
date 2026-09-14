import { describe, expect, it } from 'vitest';

import { ellipseAxes, hash01, orbRadiusForTier, ringRadii, singleRingRadius } from './geometry';

describe('hash01', () => {
  it('is stable and stays within 0–1', () => {
    expect(hash01('house')).toBe(hash01('house'));
    for (const text of ['', 'a', 'house', 'Business continuity']) {
      expect(hash01(text)).toBeGreaterThanOrEqual(0);
      expect(hash01(text)).toBeLessThan(1);
    }
  });
});

describe('ringRadii', () => {
  it('puts a sparse ring just clear of the hub', () => {
    expect(ringRadii(44, [{ count: 3, orbRadius: 40 }], 12)).toEqual([96]);
  });

  it('widens a crowded ring until its orbs fit side by side', () => {
    const [radius = 0] = ringRadii(44, [{ count: 30, orbRadius: 40 }], 12);
    expect(2 * Math.PI * radius).toBeCloseTo(30 * 92);
  });

  it('keeps each ring clear of the one inside it', () => {
    const [inner = 0, outer = 0] = ringRadii(
      44,
      [
        { count: 20, orbRadius: 40 },
        { count: 2, orbRadius: 30 },
      ],
      12,
    );
    expect(outer).toBeGreaterThanOrEqual(inner + 40 + 30 + 12);
  });

  it('gives an empty ring no room', () => {
    const [, , outer] = ringRadii(
      44,
      [
        { count: 2, orbRadius: 40 },
        { count: 0, orbRadius: 40 },
        { count: 2, orbRadius: 30 },
      ],
      12,
    );
    expect(outer).toBe(96 + 40 + 30 + 12);
  });
});

describe('singleRingRadius', () => {
  it('fits every orb around the ring', () => {
    const radii = [60, 40, 50, 70, 30, 45, 55, 65, 35, 42];
    const circumference = radii.reduce((total, r) => total + 2 * r + 10, 0);
    expect(singleRingRadius(54, radii, 10)).toBeCloseTo(circumference / (2 * Math.PI));
  });

  it('clears the hub when there are only a few orbs', () => {
    expect(singleRingRadius(54, [40], 10)).toBe(104);
  });
});

describe('orbRadiusForTier', () => {
  it('leaves small tiers alone and shrinks crowded ones to a floor', () => {
    expect(orbRadiusForTier(40, 4)).toBe(40);
    expect(orbRadiusForTier(40, 25)).toBeCloseTo(32);
    expect(orbRadiusForTier(40, 64)).toBeCloseTo(24.8);
    expect(orbRadiusForTier(40, 1000)).toBeCloseTo(24.8);
  });
});

describe('ellipseAxes', () => {
  it('stretches along the longer side and preserves area', () => {
    const { kx, ky } = ellipseAxes(1600, 900);
    expect(kx).toBeGreaterThan(1);
    expect(kx * ky).toBeCloseTo(1);
  });

  it('copes with a container that has no height yet', () => {
    expect(ellipseAxes(800, 0)).toEqual({ kx: 1, ky: 1 });
  });
});
