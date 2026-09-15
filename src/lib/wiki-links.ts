export const WIKI_PROTOCOL = 'wiki:';

const WIKI_LINK = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;

/**
 * LLM-wiki text links with `[[Title]]`, `[[Title|alias]]` and
 * `[[Title#heading]]`. Markdown has no such syntax, so each becomes an
 * ordinary link to a `wiki:` URL that the renderer resolves against whatever
 * is on screen. Titles broken across lines by hard-wrapping are rejoined.
 */
export function wikiLinksToMarkdown(source: string): string {
  return source.replace(WIKI_LINK, (_match, target: string, alias: string | undefined) => {
    const title = target.replace(/\s+/g, ' ').trim();
    const text = (alias ?? title).replace(/\s+/g, ' ').trim().replace(/[[\]]/g, '');
    return `[${text}](${WIKI_PROTOCOL}${encodeURIComponent(title)})`;
  });
}

/** The distinct titles the `[[wiki links]]` in `source` point at, in order of first appearance. */
export function wikiLinkTitles(source: string): string[] {
  const titles = new Set<string>();
  for (const match of source.matchAll(WIKI_LINK)) {
    const title = match[1]?.replace(/\s+/g, ' ').trim();
    if (title) titles.add(title);
  }
  return [...titles];
}

/** The title a `wiki:` URL points at, or null for any other URL. */
export function parseWikiHref(href: string): string | null {
  if (!href.startsWith(WIKI_PROTOCOL)) return null;
  try {
    return decodeURIComponent(href.slice(WIKI_PROTOCOL.length));
  } catch {
    return null;
  }
}
