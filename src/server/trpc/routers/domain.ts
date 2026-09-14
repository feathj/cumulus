import { listDomains } from '../../services/domains';
import { procedure, router } from '../init';

export const domainRouter = router({
  list: procedure.query(({ ctx }) => listDomains(ctx.db)),
});
