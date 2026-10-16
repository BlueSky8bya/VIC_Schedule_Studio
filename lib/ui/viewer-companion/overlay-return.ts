import { sampleCompanionTravel } from "./motion";
import { COMPANION_TIMING } from "./timing";

export type CompanionReturnPoint = { x: number; y: number; scale: number };
export const COMPANION_RETURN_SETTLE_MS = 350;
const MAX_GEOMETRY_WAIT_MS = 1000;

/** A finite display bridge, not a world/physics controller or another clock.
 * The existing renderer supplies its current DOM support on each sample. */
export function createCompanionOverlayReturn(from: CompanionReturnPoint, began: number, wake: boolean, travelMs: number) {
  const source = { ...from };
  let readyAt: number | undefined;
  let shown = source;
  return {
    sample(now: number, target: CompanionReturnPoint, ready: boolean, reduced = false) {
      const time = Number.isFinite(now) ? Math.max(began, now) : began;
      const elapsed = time - began;
      if (ready && readyAt === undefined) readyAt = time;
      const expired = !ready && readyAt !== undefined || readyAt === undefined && elapsed >= MAX_GEOMETRY_WAIT_MS;
      if (expired) return { point: shown, progress: 0, expired: true, done: true, phase: "done" as const };
      const hold = reduced ? 0 : wake ? COMPANION_TIMING.presenceWake : 160;
      const start = Math.max(began + hold, readyAt ?? time);
      const duration = reduced ? 0 : Math.max(1, travelMs);
      const progress = readyAt === undefined ? 0 : duration ? Math.min(1, Math.max(0, (time - start) / duration)) : 1;
      const p = sampleCompanionTravel(progress);
      const point = {
        x: source.x + (target.x - source.x) * p,
        y: source.y + (target.y - source.y) * p,
        scale: source.scale + (target.scale - source.scale) * p,
      };
      shown = point;
      const settled = readyAt !== undefined && time >= start + duration;
      const done = expired || settled && time >= start + duration + COMPANION_RETURN_SETTLE_MS;
      return { point, progress, expired, done, phase: done ? "done" as const : settled ? "settle" as const : progress > 0 ? "return" as const : "wake" as const };
    },
  };
}
