/** Longest slug made from a title: enough to stay recognisable in a URL. */
export const SLUG_MAX = 48;

/**
 * A URL-safe version of a title: lower-case ASCII letters and digits joined by
 * single dashes. Accents are dropped rather than the letters they sit on, and
 * a title with nothing usable falls back to `fallback`.
 */
export function slugify(title: string, fallback = 'untitled'): string {
  const slug = title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
  return slug || fallback;
}

/** `base` if it's free, otherwise the first free of `base-2`, `base-3`, … */
export function uniqueSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
