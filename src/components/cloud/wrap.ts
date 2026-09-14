function truncate(line: string, maxWidth: number, measure: (text: string) => number): string {
  let text = line;
  while (text.length > 1 && measure(`${text}…`) > maxWidth) text = text.slice(0, -1);
  return `${text.trimEnd()}…`;
}

/**
 * Greedy word wrap into at most `maxLines` lines no wider than `maxWidth`, as
 * measured by `measure` (canvas `measureText` in practice). If text is left
 * over, the last line ends in an ellipsis; a single word too wide for a line is
 * cut with one too.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  maxLines: number,
  measure: (text: string) => number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  let overflow = false;

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (lines.length >= maxLines) {
      overflow = true;
      current = '';
      break;
    }
    current = word;
  }
  if (current) {
    if (lines.length < maxLines) lines.push(current);
    else overflow = true;
  }

  const fitted = lines.map((line) =>
    measure(line) <= maxWidth ? line : truncate(line, maxWidth, measure),
  );
  const last = fitted.length - 1;
  if (overflow && last >= 0 && !fitted[last]?.endsWith('…')) {
    fitted[last] = truncate(fitted[last] ?? '', maxWidth, measure);
  }
  return fitted;
}
