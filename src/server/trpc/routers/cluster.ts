import {
  archiveCluster,
  createCluster,
  getClusterBoard,
  listClusters,
  restoreCluster,
} from '../../services/clusters';
import { procedure, router } from '../init';
import { clusterInput, createClusterInput, domainInput, idInput } from '../inputs';

export const clusterRouter = router({
  list: procedure
    .input(domainInput)
    .query(({ ctx, input }) => listClusters(ctx.db, input.domainSlug)),

  board: procedure
    .input(clusterInput)
    .query(({ ctx, input }) => getClusterBoard(ctx.db, input.domainSlug, input.clusterSlug)),

  /** A new, empty cluster in a domain; returns its slug for linking. */
  create: procedure
    .input(createClusterInput)
    .mutation(({ ctx, input }) => createCluster(ctx.db, input)),

  archive: procedure.input(idInput).mutation(({ ctx, input }) => archiveCluster(ctx.db, input.id)),

  restore: procedure.input(idInput).mutation(({ ctx, input }) => restoreCluster(ctx.db, input.id)),
});
