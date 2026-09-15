import { createCallerFactory, router } from './init';
import { clusterRouter } from './routers/cluster';
import { domainRouter } from './routers/domain';
import { focusRouter } from './routers/focus';
import { inboxRouter } from './routers/inbox';
import { journalRouter } from './routers/journal';
import { memoryRouter } from './routers/memory';
import { nodeRouter } from './routers/node';
import { routineRouter } from './routers/routine';
import { todayRouter } from './routers/today';

export const appRouter = router({
  cluster: clusterRouter,
  domain: domainRouter,
  focus: focusRouter,
  inbox: inboxRouter,
  journal: journalRouter,
  memory: memoryRouter,
  node: nodeRouter,
  routine: routineRouter,
  today: todayRouter,
});

export type AppRouter = typeof appRouter;

/** Calls procedures in-process, without HTTP — for tests and scripts. */
export const createCaller = createCallerFactory(appRouter);
