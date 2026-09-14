import {
  archiveInboxItem,
  captureIdea,
  fileInboxItem,
  listInbox,
  restoreInboxItem,
  updateInboxItem,
} from '../../services/inbox';
import { procedure, router } from '../init';
import { captureInput, domainInput, fileInboxInput, idInput, updateInboxInput } from '../inputs';

export const inboxRouter = router({
  list: procedure.input(domainInput).query(({ ctx, input }) => listInbox(ctx.db, input.domainSlug)),

  /** From the capture box: straight into the current domain's inbox. */
  capture: procedure.input(captureInput).mutation(({ ctx, input }) => captureIdea(ctx.db, input)),

  update: procedure.input(updateInboxInput).mutation(({ ctx, input }) => updateInboxItem(ctx.db, input)),

  /** Turn a capture into a card in a cluster. */
  file: procedure.input(fileInboxInput).mutation(({ ctx, input }) => fileInboxItem(ctx.db, input)),

  archive: procedure.input(idInput).mutation(({ ctx, input }) => archiveInboxItem(ctx.db, input.id)),

  restore: procedure.input(idInput).mutation(({ ctx, input }) => restoreInboxItem(ctx.db, input.id)),
});
