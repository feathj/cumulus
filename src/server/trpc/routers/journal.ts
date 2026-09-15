import { saveJournal } from '../../services/journal';
import { procedure, router } from '../init';
import { saveJournalInput } from '../inputs';

export const journalRouter = router({
  /** Save a day's journal; empty text removes it. */
  save: procedure.input(saveJournalInput).mutation(({ ctx, input }) => saveJournal(ctx.db, input)),
});
