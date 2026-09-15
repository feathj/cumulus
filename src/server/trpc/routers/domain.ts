import { listDomainCloud, listDomains } from '../../services/domains';
import { procedure, router } from '../init';

export const domainRouter = router({
  list: procedure.query(({ ctx }) => listDomains(ctx.db)),

  /** Every domain with its clusters: the top-level cloud, and where the inbox can file to. */
  cloud: procedure.query(({ ctx }) => listDomainCloud(ctx.db)),
});
