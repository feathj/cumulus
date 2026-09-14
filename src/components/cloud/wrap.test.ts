import { describe, expect, it } from 'vitest';

import { wrapText } from './wrap';

// One unit per character, so widths are easy to reason about.
const measure = (text: string) => text.length;

describe('wrapText', () => {
  it('wraps words onto lines that fit', () => {
    expect(wrapText('one two three', 7, 3, measure)).toEqual(['one two', 'three']);
  });

  it('ends with an ellipsis when it runs out of lines', () => {
    expect(wrapText('one two three', 7, 1, measure)).toEqual(['one tw…']);
  });

  it('cuts a single word that is too wide', () => {
    expect(wrapText('extraordinary', 5, 2, measure)).toEqual(['extr…']);
  });

  it('returns nothing for blank text', () => {
    expect(wrapText('   ', 10, 3, measure)).toEqual([]);
  });

  it('keeps short text on one line', () => {
    expect(wrapText('Books', 20, 3, measure)).toEqual(['Books']);
  });
});
