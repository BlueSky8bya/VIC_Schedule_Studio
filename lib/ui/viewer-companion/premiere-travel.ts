import { sampleCompanionTravel } from "./motion";
import type { CompanionReturnPoint } from "./overlay-return";

/** A finite display path only. Its endpoints came from actual public card
 * geometry and a safe viewport/support; no world/planner point is changed. */
export function sampleCompanionPremiereTravel(from: CompanionReturnPoint, to: CompanionReturnPoint, progress: number, size: number, returning = false) {
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const p = sampleCompanionTravel(t);
  const clearance = Math.max(0, Math.min(from.y - size * from.scale - 4, to.y - size * to.scale - 4));
  const baseline = from.y + (to.y - from.y) * p;
  // Keep the takeoff body readable; only fold it into the card near landing.
  // A cramped header still bounds the full scaled cell above the viewport.
  const fold = returning ? p : sampleCompanionTravel(Math.max(0, (t - .45) / .55));
  const scale = Math.min(from.scale + (to.scale - from.scale) * fold, Math.max(0, (baseline - 4) / size));
  const lift = returning ? Math.min(62, clearance) * Math.sin(t * Math.PI) : Math.min(82 * Math.sin(t * Math.PI), Math.max(0, baseline - size * scale - 4));
  return {
    x: from.x + (to.x - from.x) * p,
    y: baseline - lift,
    scale,
    opacity: returning ? Math.min(1, t * 5) : Math.min(1, (1 - t) * 5),
  };
}
