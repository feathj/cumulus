import { describe, expect, it } from 'vitest';

import { SLUG_MAX, slugify, uniqueSlug } from './slug';

describe('slugify', () => {
  it.each([
    ['Home & Garden', 'home-and-garden'],
    ['  Café   Plans! ', 'cafe-plans'],
    ['--Guitar--', 'guitar'],
    ['P1: Push infrastructure', 'p1-push-infrastructure'],
  ])('turns %j into %j', (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  it('falls back when nothing usable is left', () => {
    expect(slugify('日本')).toBe('untitled');
    expect(slugify('!!!', 'cluster')).toBe('cluster');
  });

  it('cuts a long title without leaving a trailing dash', () => {
    const slug = slugify(`${'a'.repeat(SLUG_MAX - 1)} bcd`);

    expect(slug).toBe('a'.repeat(SLUG_MAX - 1));
  });
});

describe('uniqueSlug', () => {
  it('keeps a free slug and numbers a taken one', () => {
    expect(uniqueSlug('house', new Set())).toBe('house');
    expect(uniqueSlug('house', new Set(['house']))).toBe('house-2');
    expect(uniqueSlug('house', new Set(['house', 'house-2']))).toBe('house-3');
  });
});
