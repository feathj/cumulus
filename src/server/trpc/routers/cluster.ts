import { z } from 'zod';

import { getClusterBoard, listClusters } from '../../services/clusters';
import { procedure, router } from '../init';

const slug = z.string().trim().min(1).max(100);

export const clusterRouter = router({
  list: procedure
    .input(z.object({ domainSlug: slug }))
    .query(({ ctx, input }) => listClusters(ctx.db, input.domainSlug)),

  board: procedure
    .input(z.object({ domainSlug: slug, clusterSlug: slug }))
    .query(({ ctx, input }) => getClusterBoard(ctx.db, input.domainSlug, input.clusterSlug)),
});
