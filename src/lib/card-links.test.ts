import { describe, expect, it } from 'vitest';

import { findUrls, hasProse, isYouTubeUrl, linkKind } from './card-links';

describe('findUrls', () => {
  it('finds bare and markdown links once each, without trailing punctuation', () => {
    const text =
      'See https://example.com/a. Or [https://youtu.be/x](https://youtu.be/x "smartCard-inline"), https://example.com/a!';

    expect(findUrls(text)).toEqual(['https://example.com/a', 'https://youtu.be/x']);
  });

  it('finds nothing in text without links', () => {
    expect(findUrls('Seal the deck before winter')).toEqual([]);
  });
});

describe('isYouTubeUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=yEpcimfWKrw',
    'https://youtu.be/yEpcimfWKrw',
    'https://m.youtube.com/watch?v=yEpcimfWKrw',
    'https://music.youtube.com/watch?v=yEpcimfWKrw',
    'https://www.youtube-nocookie.com/embed/yEpcimfWKrw',
  ])('recognises %s', (url) => {
    expect(isYouTubeUrl(url)).toBe(true);
  });

  it.each(['https://notyoutube.com/watch?v=1', 'https://example.com/?next=youtube.com', 'not a url'])(
    'rejects %s',
    (url) => {
      expect(isYouTubeUrl(url)).toBe(false);
    },
  );
});

describe('linkKind', () => {
  it('prefers youtube when any link is a video', () => {
    expect(linkKind(['https://www.amazon.com/dp/B0BW8FXWFY', 'https://youtu.be/abc'])).toBe('youtube');
  });

  it('is a plain link otherwise, and null with no links', () => {
    expect(linkKind(['https://www.amazon.com/dp/B0BW8FXWFY'])).toBe('link');
    expect(linkKind([])).toBeNull();
  });
});

describe('hasProse', () => {
  it.each([
    ['nothing', null],
    ['whitespace', '  \n '],
    ['a bare link', 'https://www.youtube.com/watch?v=YLRAqMV7SsA'],
    [
      'a Trello smart card',
      '[https://www.youtube.com/watch?v=Jamb5LAGhmY&t=10s](https://www.youtube.com/watch?v=Jamb5LAGhmY&t=10s "smartCard-embed")',
    ],
    ['several links', 'https://www.amazon.com/dp/B087JDFH4K/\n\nhttps://blog.recessedlighting.com/calculator/'],
    ['an autolink', '<https://example.com>'],
  ])('is false for %s', (_name, description) => {
    expect(hasProse(description)).toBe(false);
  });

  it.each([
    ['plain text', 'Ask the neighbour which sealer he used.'],
    ['a labelled link', '[the recipe](https://www.curiouscuisiniere.com/feijoada/)'],
    ['text beside a link', 'Watch this first: https://youtu.be/abc'],
    ['a price', '$38'],
  ])('is true for %s', (_name, description) => {
    expect(hasProse(description)).toBe(true);
  });
});
