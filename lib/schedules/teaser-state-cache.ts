// Process single-flight supplements Next Data Cache/CDN, not a distributed lock.
export function singleFlightCache<T>(maxKeys = 128) {
  const cache = new Map<string, { expires: number; value: Promise<T> }>();
  return (key: string, load: () => Promise<T>, ttlMs: number | ((value: T) => number) = 1000): Promise<T> => {
    const prior = cache.get(key);
    if (prior && prior.expires > Date.now()) return prior.value;
    if (cache.size >= maxKeys) {
      for (const [id, entry] of cache) if (entry.expires <= Date.now()) cache.delete(id);
      if (cache.size >= maxKeys) cache.delete(cache.keys().next().value!);
    }
    const entry: { expires: number; value: Promise<T> } = { expires: Infinity, value: Promise.resolve(null as T) };
    entry.value = load().then(value => { entry.expires = Date.now() + (typeof ttlMs === "number" ? ttlMs : ttlMs(value)); return value; }, error => { cache.delete(key); throw error; });
    cache.set(key, entry);
    return entry.value;
  };
}
