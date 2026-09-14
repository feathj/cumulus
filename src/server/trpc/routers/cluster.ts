import { getClusterBoard, listClusters } from '../../services/clusters';
import { procedure, router } from '../init';
import { clusterInput, domainInput } from '../inputs';

export const clusterRouter = router({
  list: procedure
    .input(domainInput)
    .query(({ ctx, input }) => listClusters(ctx.db, input.domainSlug)),

  board: procedure
    .input(clusterInput)
    .query(({ ctx, input }) => getClusterBoard(ctx.db, input.domainSlug, input.clusterSlug)),
});
