import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';

import { getQueryClient, trpc } from '@/trpc/server';

/** There's no home page as such: open the first domain. */
export default async function HomePage() {
  await connection();
  const [first] = await getQueryClient().fetchQuery(trpc.domain.list.queryOptions());
  if (first) redirect(`/${first.slug}`);

  return (
    <Box component="main" sx={{ px: 6, py: 6 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Cumulus
      </Typography>
      <Typography sx={{ color: 'text.secondary' }}>
        No domains yet. Run <code>npm run db:import</code> or <code>npm run db:seed</code>.
      </Typography>
    </Box>
  );
}
