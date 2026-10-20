/** Fixed local catalogue, precomputed once. A draw consumes exactly one RNG
 * sample and excludes the entire previous interval without retry/allocation.
 * Integer masses keep every remaining interval and the total exact. */
export function createBoundedWeightedCatalog<K extends string>(entries: readonly Readonly<{ id: K; mass: number }>[]) {
  if (entries.length < 2 || entries.length > 512) throw new Error("Bounded weighted catalogue needs2..512 entries");
  let total = 0;
  const ids: K[] = [], ends: number[] = [], intervals = new Map<string, Readonly<{ start: number; mass: number }>>();
  for (const { id, mass } of entries) {
    if (typeof id !== "string" || !id || intervals.has(id) || !Number.isSafeInteger(mass) || mass <= 0 || !Number.isSafeInteger(total + mass)) throw new Error("Invalid fixed catalogue entry");
    intervals.set(id, { start: total, mass }); total += mass; ids.push(id); ends.push(total);
  }
  return Object.freeze({
    totalMass: total,
    chance(id: unknown, previous?: unknown): number {
      const value = typeof id === "string" ? intervals.get(id) : undefined;
      if (!value || id === previous) return 0;
      const removed = typeof previous === "string" ? intervals.get(previous)?.mass ?? 0 : 0;
      return value.mass / (total - removed);
    },
    draw(previous?: unknown, rng: () => number = Math.random): K {
      const raw = rng(), fraction = Number.isFinite(raw) ? Math.max(0, Math.min(1 - Number.EPSILON, raw)) : 0;
      const removed = typeof previous === "string" ? intervals.get(previous) : undefined;
      let point = fraction * (total - (removed?.mass ?? 0));
      if (removed && point >= removed.start) point += removed.mass;
      let low = 0, high = ends.length - 1;
      while (low < high) { const middle = (low + high) >>> 1; if (point < ends[middle]) high = middle; else low = middle + 1; }
      return ids[low];
    },
  });
}
