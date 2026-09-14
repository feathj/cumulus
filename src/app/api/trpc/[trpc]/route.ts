import { fetchRequestHandler } from '@trpc/server/adapters/fetch';

import { createContext } from '@/server/trpc/context';
import { appRouter } from '@/server/trpc/root';

function handler(req: Request): Promise<Response> {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
    ...(process.env.NODE_ENV === 'development'
      ? {
          onError: ({ path, error }) => {
            console.error(`tRPC error on ${path ?? '<no path>'}: ${error.message}`);
          },
        }
      : {}),
  });
}

export { handler as GET, handler as POST };
