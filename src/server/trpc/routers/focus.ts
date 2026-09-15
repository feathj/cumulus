import { addToFocus, removeFromFocus } from '../../services/focus';
import { procedure, router } from '../init';
import { idInput } from '../inputs';

/** A card's place in its domain's focus block. Ids are node ids. */
export const focusRouter = router({
  add: procedure.input(idInput).mutation(({ ctx, input }) => addToFocus(ctx.db, input.id)),

  remove: procedure.input(idInput).mutation(({ ctx, input }) => removeFromFocus(ctx.db, input.id)),
});
