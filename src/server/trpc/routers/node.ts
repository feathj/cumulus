import { getNodeDetail, moveNode } from '../../services/nodes';
import { procedure, router } from '../init';
import { idInput, moveInput } from '../inputs';

export const nodeRouter = router({
  detail: procedure.input(idInput).query(({ ctx, input }) => getNodeDetail(ctx.db, input.id)),

  /** Reorder a card within its tier, or move it to another priority. */
  move: procedure.input(moveInput).mutation(({ ctx, input }) => moveNode(ctx.db, input)),
});
