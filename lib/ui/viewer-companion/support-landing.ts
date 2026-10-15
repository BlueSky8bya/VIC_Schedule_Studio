import type { Platform } from "./brain";

/** Geometry already supplies safe character-centre intervals. Passive landing
 * preserves the current x, including at a safe edge, rather than applying the
 * brain's walking inset or choosing a horizontally distant floor. The caller
 * owns visibility/recovery when no genuine support covers this x. */
export function nearestVerticalCompanionSupport(point: Readonly<{ x: number; y: number }>, platforms: readonly Platform[]): Platform | undefined {
  if (![point.x, point.y].every(Number.isFinite)) return undefined;
  let nearest: Platform | undefined;
  let height = Infinity;
  for (const platform of platforms) {
    const end = platform.x + platform.width;
    if (!platform.id || ![platform.x, platform.y, platform.width, end].every(Number.isFinite)
      || platform.width <= 0 || point.x < platform.x || point.x > end) continue;
    const distance = Math.abs(platform.y - point.y);
    if (!Number.isFinite(distance)) continue;
    if (distance < height || distance === height && nearest?.kind === "floor" && platform.kind !== "floor") {
      nearest = platform; height = distance;
    }
  }
  return nearest;
}
