
import { forceRefreshServerNow, getServerNowCached, isServerTimeFresh } from '@/src/lib/serverTimeCache';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export type ServerNowState = {
  serverNow: Date | null;
  loading: boolean;
  error: string | null;
  refresh: (opts?: { force?: boolean }) => Promise<void>;
  isFresh: boolean;
};

type Options = {
  ttlMs?: number;       // default 1hr
  refreshOnForeground?: boolean; // default true
};

const DEFAULT_TTL_MS = 3600_000;

export function useServerNow(opts: Options = {}): ServerNowState {
  const ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  const refreshOnForeground = opts.refreshOnForeground ?? true;

  const [serverNow, setServerNow] = useState<Date | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFresh, setIsFresh] = useState<boolean>(false);

  const mountedRef = useRef(true);

  const refresh = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const dt = force ? await forceRefreshServerNow() : await getServerNowCached(ttlMs);
        if (mountedRef.current) {
          setServerNow(dt);
          setIsFresh(isServerTimeFresh(ttlMs));
        }
      } catch (e: any) {
        if (mountedRef.current) {
          setError(e?.message ?? 'Failed to get server time');
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [ttlMs]
  );

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    refresh().catch(() => {});
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  // Optional: refresh when app returns to foreground (if cache expired)
  useEffect(() => {
    if (!refreshOnForeground) return;

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active' && !isServerTimeFresh(ttlMs)) {
        // Only refresh if cache expired
        refresh().catch(() => {});
      }
    });

    return () => sub.remove();
  }, [refreshOnForeground, ttlMs, refresh]);

  return { serverNow, loading, error, refresh, isFresh };
}
