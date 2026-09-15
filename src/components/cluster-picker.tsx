'use client';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import { oklch } from '@/lib/color';
import { domainPalette, neutral } from '@/lib/palette';
import type { CloudCluster, DomainCloudEntry } from '@/server/services/domains';

/** A cluster, and the domain it's in. */
export interface ClusterTarget {
  domain: DomainCloudEntry;
  cluster: CloudCluster;
}

/**
 * Chooses a cluster in any domain: a row of domains in their own colours, then
 * the chosen domain's clusters. The chosen domain is the caller's, so it can
 * outlive the picker being hidden.
 */
export function ClusterPicker({
  label,
  domains,
  domainSlug,
  onDomainChange,
  onPick,
  excludeClusterId,
  disabled = false,
}: {
  label: string;
  domains: DomainCloudEntry[];
  domainSlug: string | null;
  onDomainChange: (domainSlug: string | null) => void;
  onPick: (target: ClusterTarget) => void;
  /** A cluster not to offer, such as the one a card is already in. */
  excludeClusterId?: string;
  disabled?: boolean;
}) {
  const chosen = domains.find((domain) => domain.slug === domainSlug) ?? null;
  const clusters = chosen?.clusters.filter((cluster) => cluster.id !== excludeClusterId) ?? [];

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.9 }}>
        <Typography
          component="span"
          sx={{ fontSize: 9.5, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'text.secondary', mr: 0.5 }}
        >
          {label}
        </Typography>
        {domains.map((domain) => (
          <DomainChoice
            key={domain.id}
            domain={domain}
            selected={domain.slug === domainSlug}
            onClick={() => onDomainChange(domain.slug === domainSlug ? null : domain.slug)}
          />
        ))}
      </Box>
      {chosen && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.9, mt: 1 }}>
          {clusters.map((cluster) => (
            <ClusterChoice
              key={cluster.id}
              hue={chosen.themeHue}
              disabled={disabled}
              onClick={() => onPick({ domain: chosen, cluster })}
            >
              {cluster.title}
            </ClusterChoice>
          ))}
          {clusters.length === 0 && (
            <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>
              no {chosen.clusters.length ? 'other ' : ''}clusters in {chosen.title} yet
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}

/** A domain to choose, in its own colour. Choosing one shows its clusters. */
function DomainChoice({
  domain,
  selected,
  onClick,
}: {
  domain: DomainCloudEntry;
  selected: boolean;
  onClick: () => void;
}) {
  const colors = domainPalette(domain.themeHue);
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={selected}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        border: `1px solid ${selected ? colors.border : neutral.line}`,
        bgcolor: selected ? colors.soft : 'transparent',
        color: selected ? colors.accent : neutral.textSoft,
        borderRadius: 0.75,
        px: 1.3,
        py: 0.55,
        fontSize: 12,
        '&:hover': { borderColor: colors.border, color: colors.accent },
      }}
    >
      <Box component="span" aria-hidden sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: colors.accentBright }} />
      {domain.title}
    </ButtonBase>
  );
}

function ClusterChoice({
  hue,
  disabled,
  onClick,
  children,
}: {
  hue: number;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  const colors = domainPalette(hue);
  return (
    <ButtonBase
      onClick={onClick}
      disabled={disabled}
      sx={{
        border: `1px solid ${colors.border}`,
        bgcolor: oklch(0.24, 0.035, hue),
        color: oklch(0.9, 0.06, hue),
        borderRadius: 0.75,
        px: 1.4,
        py: 0.6,
        fontSize: 12,
        '&:hover': { bgcolor: colors.border },
        '&.Mui-disabled': { opacity: 0.5 },
      }}
    >
      {children}
    </ButtonBase>
  );
}
