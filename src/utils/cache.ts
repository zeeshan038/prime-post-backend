import NodeCache from "node-cache";

// Create cache with default TTL (0 = no expiry)
const cache = new NodeCache({ stdTTL: 0, checkperiod: 120 });

/**
 * Get value from cache or set it if not present
 */
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const cached = cache.get<T>(key);
  if (cached) {
    return cached;
  }

  const data = await fetchFn();

  // Save to cache
  cache.set(key, data, ttlSeconds);

  return data;
}

/**
 * Delete a cache key
 */
export function delCache(key: string) {
  cache.del(key);
}

/**
 * Clear all cache (optional helper)
 */
export function clearAllCache() {
  cache.flushAll();
}
