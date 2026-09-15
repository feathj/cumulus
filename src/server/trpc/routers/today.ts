import { getDay } from '../../services/today';
import { procedure, router } from '../init';
import { dayInput } from '../inputs';

export const todayRouter = router({
  /** Routines, the focus blocks and the journal for one day. */
  day: procedure.input(dayInput).query(({ ctx, input }) => getDay(ctx.db, input)),
});
