'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// Some router actions (push/replace fired from mount-time effects and from the
// top-level UserProvider during async auth bootstrap) can be dispatched before
// the App Router's navigation instance has fully initialized on the client.
// That race produces the "Router action dispatched before initialization"
// runtime error. Delaying the action by at least one task/microtask guarantees
// the router is ready before we navigate, while still being fast enough to feel
// instant. Each call is guarded against firing on an unmounted component.
export function useSafeRouter() {
  const router = useRouter();

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const navigateAfterReady = useCallback(
    (run: () => void) => {
      const timer = setTimeout(() => {
        if (mountedRef.current) run();
      }, 0);
      return () => clearTimeout(timer);
    },
    [],
  );

  const push = useCallback(
    (href: string) => navigateAfterReady(() => router.push(href)),
    [router, navigateAfterReady],
  );

  const replace = useCallback(
    (href: string) => navigateAfterReady(() => router.replace(href)),
    [router, navigateAfterReady],
  );

  return { router, push, replace };
}
