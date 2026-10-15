import { sampleCompanionTravel } from "./motion";
import type { CompanionReturnPoint } from "./overlay-return";

/** A finite display path only. Its endpoints came from actual public card
 * geometry and a safe viewport/support; no world/planner point is changed. */
export function sampleCompanionPremiereTravel(from: CompanionReturnPoint, to: CompanionReturnPoint, progress: number, size: number, returning = false) {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const p = sampleCompanionTravel(t);
  const clearance = Math.max(0, Math.min(from.y - size * from.scale - 4, to.y - size * to.scale - 4));
  const lift = Math.min(returning ? 62 : 34, clearance) * Math.sin(t * Math.PI);
  return {
    x: from.x + (to.x - from.x) * p,
    y: from.y + (to.y - from.y) * p - lift,
    scale: from.scale + (to.scale - from.scale) * p,
    opacity: returning ? Math.min(1, t * 5) : Math.min(1, (1 - t) * 5),
  };
}
