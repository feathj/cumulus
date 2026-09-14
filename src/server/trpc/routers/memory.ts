import { getClusterMemory, getClusterMemorySummary } from '../../services/memory';
import { procedure, router } from '../init';
import { clusterInput } from '../inputs';

export const memoryRouter = router({
  cluster: procedure
    .input(clusterInput)
    .query(({ ctx, input }) => getClusterMemory(ctx.db, input.domainSlug, input.clusterSlug)),

  clusterSummary: procedure
    .input(clusterInput)
    .query(({ ctx, input }) =>
      getClusterMemorySummary(ctx.db, input.domainSlug, input.clusterSlug),
    ),
});
