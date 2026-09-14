import { describe, expect, it } from 'vitest';

import { IDEA_TITLE_MAX, splitIdea } from './ideas';

describe('splitIdea', () => {
  it('uses a one-line idea as the title', () => {
    expect(splitIdea('  Seal the deck ')).toEqual({ title: 'Seal the deck', description: null });
  });

  it('puts later lines in the description', () => {
    expect(splitIdea('Seal the deck\n\nAsk the neighbour\nwhich sealer he used')).toEqual({
      title: 'Seal the deck',
      description: 'Ask the neighbour\nwhich sealer he used',
    });
  });

  it('cuts an overlong first line at a word and carries the rest into the description', () => {
    const words = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
    const { title, description } = splitIdea(`${words}\nMore detail`);

    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(IDEA_TITLE_MAX + 1);
    expect(words.startsWith(title.slice(0, -1))).toBe(true);
    expect(description?.endsWith('\n\nMore detail')).toBe(true);
    expect(`${title.slice(0, -1)} ${description?.split('\n\n')[0]}`).toBe(words);
  });

  it('cuts a line with no spaces at the limit', () => {
    const { title, description } = splitIdea('x'.repeat(200));

    expect(title).toBe(`${'x'.repeat(IDEA_TITLE_MAX)}…`);
    expect(description).toBe('x'.repeat(80));
  });
});
