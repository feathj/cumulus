import { describe, expect, it } from 'vitest';

import { flattenColor, oklch, oklcha, oklchToRgb, withAlpha } from './color';

describe('flattenColor', () => {
  it('mixes a translucent colour into the background', () => {
    expect(flattenColor('rgba(255, 255, 255, 0.5)', '#000000')).toBe('#808080');
    expect(flattenColor('rgba(10, 20, 30, 1)', '#ffffff')).toBe('#0a141e');
    expect(flattenColor('rgba(10, 20, 30, 0)', '#ffffff')).toBe('#ffffff');
  });

  it('passes other colours through', () => {
    expect(flattenColor('#123456', '#000000')).toBe('#123456');
  });
});

describe('oklch', () => {
  it('maps the ends of the lightness axis to black and white', () => {
    expect(oklch(0, 0, 0)).toBe('#000000');
    expect(oklch(1, 0, 0)).toBe('#ffffff');
  });

  it('lands on sRGB red for its OKLCH coordinates', () => {
    const { r, g, b } = oklchToRgb(0.627955, 0.257683, 29.2339);

    expect(r).toBeGreaterThanOrEqual(254);
    expect(g).toBeLessThanOrEqual(1);
    expect(b).toBeLessThanOrEqual(1);
  });

  it('clamps colours outside the sRGB gamut', () => {
    expect(oklch(0.7, 0.4, 150)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('oklcha', () => {
  it('formats rgba with the given alpha', () => {
    expect(oklcha(1, 0, 0, 0.5)).toBe('rgba(255, 255, 255, 0.5)');
  });
});

describe('withAlpha', () => {
  it('appends a two-digit alpha channel', () => {
    expect(withAlpha('#ffffff', 0.5)).toBe('#ffffff80');
    expect(withAlpha('#000000', 2)).toBe('#000000ff');
  });
});
