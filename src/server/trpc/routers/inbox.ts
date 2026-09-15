import {
  archiveInboxItem,
  captureIdea,
  countInbox,
  fileInboxItem,
  listInbox,
  restoreInboxItem,
  updateInboxItem,
} from '../../services/inbox';
import { procedure, router } from '../init';
import { captureInput, fileInboxInput, idInput, updateInboxInput } from '../inputs';

export const inboxRouter = router({
  list: procedure.query(({ ctx }) => listInbox(ctx.db)),

  /** Ideas waiting on a decision, for the tab's badge. */
  count: procedure.query(({ ctx }) => countInbox(ctx.db)),

  /** From the capture box: into the inbox, no domain yet. */
  capture: procedure.input(captureInput).mutation(({ ctx, input }) => captureIdea(ctx.db, input)),

  update: procedure.input(updateInboxInput).mutation(({ ctx, input }) => updateInboxItem(ctx.db, input)),

  /** Turn a capture into a card in a cluster, in whichever domain that cluster is. */
  file: procedure.input(fileInboxInput).mutation(({ ctx, input }) => fileInboxItem(ctx.db, input)),

  archive: procedure.input(idInput).mutation(({ ctx, input }) => archiveInboxItem(ctx.db, input.id)),

  restore: procedure.input(idInput).mutation(({ ctx, input }) => restoreInboxItem(ctx.db, input.id)),
});
