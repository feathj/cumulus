import Box from '@mui/material/Box';
import SvgIcon from '@mui/material/SvgIcon';

import type { LinkKind } from '@/lib/card-links';
import { CARD_ICONS, cardIcons } from '@/lib/icons';

/** A card's "there's more inside" icons: description text, then a link or YouTube link. */
export function CardSignals({
  hasText,
  link,
  color,
  size = 14,
  mt = 0,
}: {
  hasText: boolean;
  link: LinkKind | null;
  /** For icons without a colour of their own. */
  color: string;
  size?: number;
  /** Nudges the row down to line up with the first line of text beside it. */
  mt?: number | string;
}) {
  const icons = cardIcons({ hasText, link });
  if (!icons.length) return null;

  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.6, flex: '0 0 auto', mt }}>
      {icons.map((name) => {
        const icon = CARD_ICONS[name];
        return (
          <SvgIcon key={name} titleAccess={icon.label} sx={{ fontSize: size, color: icon.color ?? color }}>
            <path d={icon.path} fillRule={icon.evenOdd ? 'evenodd' : undefined} />
          </SvgIcon>
        );
      })}
    </Box>
  );
}
