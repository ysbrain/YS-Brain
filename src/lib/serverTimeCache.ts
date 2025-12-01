import { fetchServerNowViaFirestore } from './serverTime';

// Configure cache behaviour
const DEFAULT_TTL_MS = 3600_000; // 1 hour

let cachedServerNow: Date | null = null;
let cachedAtMs = 0;
let inflight: Promise<Date> | null = null;

/**
 * Returns cached server time if fresh; otherwise fetches and caches it.
 * Ensures only one network request in-flight at a time.
 */
export async function getServerNowCached(ttlMs: number = DEFAULT_TTL_MS): Promise<Date> {
  const nowMs = Date.now();

  // Use cache if within TTL
  if (cachedServerNow && nowMs - cachedAtMs < ttlMs) {
    return cachedServerNow;
  }

  // Deduplicate concurrent callers
  if (inflight) {
    return inflight;
  }

  inflight = (async () => {
    try {
      const serverNow = await fetchServerNowViaFirestore();
      cachedServerNow = serverNow;
      cachedAtMs = Date.now();
      return serverNow;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Manually clears the cache. */
export function clearServerTimeCache(): void {
  cachedServerNow = null;
  cachedAtMs = 0;
}

/** Forces a refresh regardless of TTL and updates the cache. */
export async function forceRefreshServerNow(): Promise<Date> {
  clearServerTimeCache();
  return getServerNowCached(0);
}

/** Utility: checks whether the cache is currently fresh. */
export function isServerTimeFresh(ttlMs: number = DEFAULT_TTL_MS): boolean {
  return !!(cachedServerNow && Date.now() - cachedAtMs < ttlMs);
}
