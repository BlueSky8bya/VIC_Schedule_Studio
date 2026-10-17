/** One monotonic deadline spans source reads, DB calls and final checkpointing.
 * It never extends a caller's budget when a nested operation starts. */
export type WorkBudget = {
  remaining: (reserveMs?: number) => number;
  signal: (ceilingMs?: number, reserveMs?: number) => AbortSignal;
  wait: (delayMs: number, reserveMs?: number) => Promise<boolean>;
};

export function createWorkBudget(durationMs: number, now = () => performance.now()): WorkBudget {
  const deadline = now() + Math.max(0, Number.isFinite(durationMs) ? durationMs : 0);
  const remaining = (reserveMs = 0) => Math.max(0, Math.floor(deadline - now() - Math.max(0, reserveMs)));
  return {
    remaining,
    signal(ceilingMs = 10_000, reserveMs = 0) {
      const ms = Math.min(Math.max(1, ceilingMs), remaining(reserveMs));
      return ms > 0 ? AbortSignal.timeout(ms) : AbortSignal.abort(new DOMException("Work budget expired", "TimeoutError"));
    },
    async wait(delayMs, reserveMs = 0) {
      if (remaining(reserveMs) < delayMs) return false;
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return remaining(reserveMs) > 0;
    }
  };
}

/** Process-local coalescing. Failed and fulfilled work both release ownership;
 * durable work state/SQL locks remain responsible for cross-process ordering. */
export function singleFlight<T, A extends unknown[]>(load: (...args: A) => Promise<T>): (...args: A) => Promise<T> {
  let pending: Promise<T> | undefined;
  return (...args) => {
    if (pending) return pending;
    const operation = Promise.resolve().then(() => load(...args));
    const owned = operation.finally(() => { if (pending === owned) pending = undefined; });
    pending = owned;
    return owned;
  };
}
