import { describe, expect, it } from 'vitest';

import { cardIcons } from './icons';

describe('cardIcons', () => {
  it('shows the description before the link, and nothing for a bare card', () => {
    expect(cardIcons({ hasText: true, link: 'youtube' })).toEqual(['text', 'youtube']);
    expect(cardIcons({ hasText: false, link: 'link' })).toEqual(['link']);
    expect(cardIcons({ hasText: true, link: null })).toEqual(['text']);
    expect(cardIcons({ hasText: false, link: null })).toEqual([]);
  });
});
