export interface CacheEntry<T> {
  data: T;
  ts: number;
}

export function createCacheEntry<T>(data: T, ts = Date.now()): CacheEntry<T> {
  return { data, ts };
}

export function isCacheEntryFresh<T>(entry: CacheEntry<T> | null | undefined, ttlMs: number): entry is CacheEntry<T> {
  if (!entry) return false;
  return Date.now() - entry.ts < ttlMs;
}

export function getCachedData<T>(entry: CacheEntry<T> | null | undefined, ttlMs: number): T | null {
  return isCacheEntryFresh(entry, ttlMs) ? entry.data : null;
}
