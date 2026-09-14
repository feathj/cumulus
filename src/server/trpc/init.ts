import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';

import { DomainError } from '../errors';
import type { Db } from '../services/types';

export interface Context {
  db: Db;
}

const t = initTRPC.context<Context>().create({
  // Dates survive the trip to the client as Dates, not strings.
  transformer: superjson,
});

/**
 * Services throw DomainErrors so they stay usable outside tRPC. This turns one
 * into the tRPC error with the same code; anything else still surfaces as
 * INTERNAL_SERVER_ERROR.
 */
const mapDomainErrors = t.middleware(async ({ next }) => {
  const result = await next();
  const cause = result.ok ? undefined : result.error.cause;
  if (cause instanceof DomainError) {
    throw new TRPCError({ code: cause.code, message: cause.message, cause });
  }
  return result;
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

/** Every procedure goes through this. There's no auth yet: Cumulus runs on my laptop. */
export const procedure = t.procedure.use(mapDomainErrors);
