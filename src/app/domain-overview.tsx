'use client';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useSuspenseQuery } from '@tanstack/react-query';

import { useTRPC } from '@/trpc/client';

/**
 * Placeholder home page. It exists to prove the stack end to end — server
 * prefetch, hydration, a client query through tRPC, MUI — until the domain
 * tabs replace it.
 */
export function DomainOverview() {
  const trpc = useTRPC();
  const { data: domains } = useSuspenseQuery(trpc.domain.list.queryOptions());

  return (
    <Box component="main" sx={{ maxWidth: 960, mx: 'auto', px: 3, py: 6 }}>
      <Typography variant="h3" component="h1" gutterBottom>
        Cumulus
      </Typography>

      {domains.length === 0 ? (
        <Typography sx={{ color: 'text.secondary' }}>
          No domains yet. Run <code>npm run db:import</code> or <code>npm run db:seed</code>.
        </Typography>
      ) : (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          {domains.map((domain) => (
            <Card
              key={domain.id}
              variant="outlined"
              sx={{
                flex: 1,
                borderTop: 4,
                borderTopColor: `oklch(0.7 0.12 ${domain.themeHue})`,
              }}
            >
              <CardContent>
                <Typography variant="h5" component="h2">
                  {domain.title}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 2, flexWrap: 'wrap' }}>
                  <Chip size="small" label={`${domain.clusterCount} clusters`} />
                  <Chip size="small" label={`${domain.openNodeCount} open cards`} />
                  <Chip size="small" label={`${domain.focusCount} in focus`} />
                  <Chip size="small" label={`${domain.inboxCount} in inbox`} />
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
