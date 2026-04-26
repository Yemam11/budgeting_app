import { useEffect, useRef, useState } from 'react';

/**
 * Drop-in replacement for Dexie's useLiveQuery.
 * Re-fetches immediately after any db mutation (via the 'db-updated' event)
 * and also polls every 2 s as a safety net.
 */
export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: unknown[],
): T | undefined {
  const [data, setData] = useState<T | undefined>();
  // Keep latest fetcher ref so stale closures don't capture old deps
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let active = true;
    const run = () => {
      fetcherRef.current()
        .then(d => { if (active) setData(d); })
        .catch(err => console.error('[useQuery]', err));
    };
    run();
    const iv = setInterval(run, 2000);
    window.addEventListener('db-updated', run);
    return () => {
      active = false;
      clearInterval(iv);
      window.removeEventListener('db-updated', run);
    };
  // Intentionally use serialized deps; fetcher captured via ref above
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}
