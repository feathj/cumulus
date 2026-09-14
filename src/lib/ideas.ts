/** Longest a suggested card title gets before the rest of the line moves into the description. */
export const IDEA_TITLE_MAX = 120;

/**
 * Suggests a card title and description from a captured idea: the first line
 * becomes the title and anything after it the description. An overlong first
 * line is cut at a word boundary, and the rest of it leads the description.
 */
export function splitIdea(text: string): { title: string; description: string | null } {
  const [firstLine = '', ...otherLines] = text.trim().split(/\r?\n/);
  const first = firstLine.trim();
  let description = otherLines.join('\n').trim();
  let title = first;

  if (first.length > IDEA_TITLE_MAX) {
    const space = first.lastIndexOf(' ', IDEA_TITLE_MAX);
    const cut = space > IDEA_TITLE_MAX / 2 ? space : IDEA_TITLE_MAX;
    title = `${first.slice(0, cut).trimEnd()}…`;
    description = [first.slice(cut).trim(), description].filter(Boolean).join('\n\n');
  }

  return { title, description: description || null };
}
