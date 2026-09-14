import { describe, expect, it } from 'vitest';

import { parseWikiHref, wikiLinksToMarkdown } from './wiki-links';

describe('wikiLinksToMarkdown', () => {
  it('turns a bare wiki link into a markdown link', () => {
    expect(wikiLinksToMarkdown('See [[Continuity Tiers]].')).toBe(
      'See [Continuity Tiers](wiki:Continuity%20Tiers).',
    );
  });

  it('uses the alias as the link text', () => {
    expect(wikiLinksToMarkdown('the [[Bulk Export UI Design|Canvas UI]]')).toBe(
      'the [Canvas UI](wiki:Bulk%20Export%20UI%20Design)',
    );
  });

  it('drops the heading from the target', () => {
    expect(wikiLinksToMarkdown('[[2026-07-08#continuity - meeting]]')).toBe(
      '[2026-07-08](wiki:2026-07-08)',
    );
  });

  it('rejoins a title hard-wrapped across lines', () => {
    expect(wikiLinksToMarkdown('[[Bulk Export API\nInfrastructure]]')).toBe(
      '[Bulk Export API Infrastructure](wiki:Bulk%20Export%20API%20Infrastructure)',
    );
  });

  it('leaves ordinary markdown links alone', () => {
    expect(wikiLinksToMarkdown('[docs](https://example.com)')).toBe('[docs](https://example.com)');
  });
});

describe('parseWikiHref', () => {
  it('reads the title back out of a wiki URL', () => {
    expect(parseWikiHref('wiki:Bulk%20Export%20Alerting')).toBe('Bulk Export Alerting');
  });

  it('returns null for other URLs', () => {
    expect(parseWikiHref('https://example.com')).toBeNull();
  });
});
