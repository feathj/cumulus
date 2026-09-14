import { createCallerFactory, router } from './init';
import { clusterRouter } from './routers/cluster';
import { domainRouter } from './routers/domain';

export const appRouter = router({
  cluster: clusterRouter,
  domain: domainRouter,
});

export type AppRouter = typeof appRouter;

/** Calls procedures in-process, without HTTP — for tests and scripts. */
export const createCaller = createCallerFactory(appRouter);
