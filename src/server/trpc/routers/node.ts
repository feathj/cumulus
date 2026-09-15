import { archiveNode, getNodeDetail, moveNode, restoreNode, transferNode } from '../../services/nodes';
import { procedure, router } from '../init';
import { idInput, moveInput, transferInput } from '../inputs';

export const nodeRouter = router({
  detail: procedure.input(idInput).query(({ ctx, input }) => getNodeDetail(ctx.db, input.id)),

  /** Reorder a card within its tier, or move it to another priority. */
  move: procedure.input(moveInput).mutation(({ ctx, input }) => moveNode(ctx.db, input)),

  /** Move a card to another cluster, in this domain or another. */
  transfer: procedure.input(transferInput).mutation(({ ctx, input }) => transferNode(ctx.db, input)),

  archive: procedure.input(idInput).mutation(({ ctx, input }) => archiveNode(ctx.db, input.id)),

  restore: procedure.input(idInput).mutation(({ ctx, input }) => restoreNode(ctx.db, input.id)),
});
