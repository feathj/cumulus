/** What a card links to, most specific first: a video gets its own icon. */
export type LinkKind = 'youtube' | 'link';

/** A bare http(s) URL. Stops at whitespace, brackets and quotes, so markdown around it isn't swallowed. */
const URL_PATTERN = /https?:\/\/[^\s<>()[\]"']+/gi;

/** `[label](url)` or `[label](url "title")`, as Trello writes pasted links. */
const MARKDOWN_LINK = /\[([^\]]*)\]\(\s*<?[^)\s>]+>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;

/** Every distinct http(s) URL in some text, in order, without trailing sentence punctuation. */
export function findUrls(text: string): string[] {
  const urls = (text.match(URL_PATTERN) ?? []).map((url) => url.replace(/[.,;:!?]+$/, ''));
  return [...new Set(urls)];
}

export function isYouTubeUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return (
    host === 'youtu.be' ||
    host === 'youtube.com' ||
    host.endsWith('.youtube.com') ||
    host === 'youtube-nocookie.com' ||
    host.endsWith('.youtube-nocookie.com')
  );
}

/** `youtube` if any of the links is a video, `link` for any other link, null for none. */
export function linkKind(urls: Iterable<string>): LinkKind | null {
  let kind: LinkKind | null = null;
  for (const url of urls) {
    if (isYouTubeUrl(url)) return 'youtube';
    kind = 'link';
  }
  return kind;
}

/**
 * Whether a description says anything besides the links in it. Many cards are
 * just a pasted URL, and those get a link icon, not a text icon as well.
 * A markdown link keeps its label, unless the label is the URL itself.
 */
export function hasProse(description: string | null): boolean {
  if (!description) return false;
  const withoutLinks = description.replace(MARKDOWN_LINK, '$1').replace(URL_PATTERN, '');
  return /[\p{L}\p{N}]/u.test(withoutLinks);
}
