'use client';

import Box from '@mui/material/Box';
import MuiLink from '@mui/material/Link';
import { useMemo } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { sans, serif } from '@/app/theme';
import { neutral } from '@/lib/palette';
import { parseWikiHref, wikiLinksToMarkdown } from '@/lib/wiki-links';

/** What to do when a `[[wiki link]]` is clicked, or null if its target isn't on screen. */
export type WikiLinkResolver = (title: string) => (() => void) | null;

interface MarkdownProps {
  children: string;
  resolveWikiLink?: WikiLinkResolver | undefined;
  /** `compact` is for notes and asides: smaller type, tighter spacing. */
  size?: 'body' | 'compact';
}

const REMARK_PLUGINS = [remarkGfm];

function urlTransform(url: string): string {
  return parseWikiHref(url) === null ? defaultUrlTransform(url) : url;
}

function proseSx(fontSize: number, lineHeight: number) {
  return {
    fontFamily: serif,
    fontSize,
    lineHeight,
    color: neutral.textSoft,
    overflowWrap: 'anywhere',
    '& > :first-child': { mt: 0 },
    '& > :last-child': { mb: 0 },
    '& p': { my: 1 },
    '& h1, & h2, & h3, & h4, & h5, & h6': {
      fontFamily: sans,
      fontWeight: 600,
      fontSize: '0.95em',
      letterSpacing: '0.01em',
      color: neutral.text,
      mt: 2.5,
      mb: 1,
    },
    '& ul, & ol': { pl: 3, my: 1 },
    '& li': { my: 0.4 },
    '& strong': { color: neutral.text, fontWeight: 600 },
    '& code': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '0.8em',
      bgcolor: neutral.raised,
      px: 0.5,
      py: '1px',
      borderRadius: 0.5,
    },
    '& pre': {
      bgcolor: neutral.code,
      borderLeft: `1px solid ${neutral.lineStrong}`,
      px: 1.75,
      py: 1.5,
      my: 1.5,
      overflowX: 'auto',
      fontSize: 12,
      lineHeight: 1.66,
    },
    '& pre code': { bgcolor: 'transparent', p: 0, fontSize: 'inherit' },
    '& blockquote': {
      borderLeft: `2px solid ${neutral.lineStrong}`,
      pl: 1.75,
      mx: 0,
      my: 1.5,
      color: neutral.muted,
    },
    '& table': {
      display: 'block',
      overflowX: 'auto',
      borderCollapse: 'collapse',
      fontFamily: sans,
      fontSize: '0.8em',
      lineHeight: 1.45,
      my: 1.5,
    },
    '& th, & td': {
      border: `1px solid ${neutral.line}`,
      px: 1,
      py: 0.6,
      textAlign: 'left',
      verticalAlign: 'top',
    },
    '& th': { color: neutral.text, fontWeight: 600 },
    '& hr': { border: 0, borderTop: `1px solid ${neutral.line}`, my: 2 },
  } as const;
}

const bodySx = proseSx(15.5, 1.64);
const compactSx = proseSx(14, 1.55);

/**
 * Renders the markdown every Cumulus text field holds. Raw HTML stays escaped
 * (react-markdown's default), GitHub tables and lists work, and `[[wiki
 * links]]` become buttons when `resolveWikiLink` can find their target.
 */
export function Markdown({ children, resolveWikiLink, size = 'body' }: MarkdownProps) {
  const components = useMemo<Components>(
    () => ({
      a({ href, children: text }) {
        const wikiTitle = href ? parseWikiHref(href) : null;
        if (wikiTitle !== null) {
          const open = resolveWikiLink?.(wikiTitle) ?? null;
          if (open) {
            return (
              <MuiLink
                component="button"
                type="button"
                onClick={open}
                sx={{ font: 'inherit', verticalAlign: 'baseline', textAlign: 'left' }}
              >
                {text}
              </MuiLink>
            );
          }
          return (
            <Box
              component="span"
              title="Not part of this view"
              sx={{ borderBottom: `1px dotted ${neutral.muted}` }}
            >
              {text}
            </Box>
          );
        }
        return (
          <MuiLink href={href ?? '#'} target="_blank" rel="noopener noreferrer">
            {text}
          </MuiLink>
        );
      },
    }),
    [resolveWikiLink],
  );

  return (
    <Box sx={size === 'compact' ? compactSx : bodySx}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        components={components}
        urlTransform={urlTransform}
      >
        {wikiLinksToMarkdown(children)}
      </ReactMarkdown>
    </Box>
  );
}
