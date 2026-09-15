import {
  archiveRoutine,
  createRoutine,
  moveRoutine,
  renameRoutine,
  restoreRoutine,
  setRoutineChecked,
} from '../../services/routines';
import { procedure, router } from '../init';
import { checkRoutineInput, createRoutineInput, idInput, moveRoutineInput, renameRoutineInput } from '../inputs';

export const routineRouter = router({
  create: procedure.input(createRoutineInput).mutation(({ ctx, input }) => createRoutine(ctx.db, input)),

  rename: procedure.input(renameRoutineInput).mutation(({ ctx, input }) => renameRoutine(ctx.db, input)),

  move: procedure.input(moveRoutineInput).mutation(({ ctx, input }) => moveRoutine(ctx.db, input)),

  /** Retire a routine, keeping the days it was done. */
  archive: procedure.input(idInput).mutation(({ ctx, input }) => archiveRoutine(ctx.db, input.id)),

  restore: procedure.input(idInput).mutation(({ ctx, input }) => restoreRoutine(ctx.db, input.id)),

  /** Check a routine off for a day, or un-check it. */
  check: procedure.input(checkRoutineInput).mutation(({ ctx, input }) => setRoutineChecked(ctx.db, input)),
});
