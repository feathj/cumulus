import { getNodeDetail } from '../../services/nodes';
import { procedure, router } from '../init';
import { idInput } from '../inputs';

export const nodeRouter = router({
  detail: procedure.input(idInput).query(({ ctx, input }) => getNodeDetail(ctx.db, input.id)),
});
