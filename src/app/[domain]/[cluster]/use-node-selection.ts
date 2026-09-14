'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * The selected card lives in `?node=`, so a selection survives a reload and
 * can be linked to. It's view state rather than data, so changing it updates
 * the URL through the History API without a server round trip.
 */
export function useNodeSelection() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('node');

  const navigate = useCallback(
    (change: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      change(params);
      const query = params.toString();
      window.history.pushState(null, '', query ? `${pathname}?${query}` : pathname);
    },
    [pathname, searchParams],
  );

  const select = useCallback(
    (id: string) => navigate((params) => params.set('node', id)),
    [navigate],
  );
  const clear = useCallback(() => navigate((params) => params.delete('node')), [navigate]);

  return { selectedId, select, clear };
}
