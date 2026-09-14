import { defaultShouldDehydrateQuery, QueryClient } from '@tanstack/react-query';
import superjson from 'superjson';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data prefetched on the server shouldn't be refetched the moment the
        // page hydrates.
        staleTime: 30_000,
      },
      dehydrate: {
        serializeData: superjson.serialize,
        // Send queries still in flight too, so a Server Component can start a
        // fetch without awaiting it and the client picks it up.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === 'pending',
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  });
}
