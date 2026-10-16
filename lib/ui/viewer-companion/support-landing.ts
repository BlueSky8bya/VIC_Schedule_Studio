import type { Platform } from "./brain";

/** A deliberate release collides with the first real ledge below it, rather
 * than the nearest absolute height. Exact vertical rays win; edge attraction
 * is an explicit fallback only when no span covers the release x at all. */
export function firstCompanionSupportBelow(point: Readonly<{ x: number; y: number }>, platforms: readonly Platform[], edgeTolerance = 0): Platform | undefined {
  if (![point.x, point.y].every(Number.isFinite)) return undefined;
  const tolerance = Number.isFinite(edgeTolerance) ? Math.max(0, edgeTolerance) : 0;
  let exact: Platform | undefined, edge: Platform | undefined, edgeDistance = Infinity;
  const before = (a: Platform, b: Platform | undefined) => !b || a.y < b.y || a.y === b.y && (a.kind !== "floor" && b.kind === "floor" || (a.kind === "floor") === (b.kind === "floor") && a.id < b.id);
  for (const platform of platforms) {
    const end = platform.x + platform.width;
    if (!platform.id || ![platform.x, platform.y, platform.width, end].every(Number.isFinite) || platform.width <= 0 || platform.y < point.y - .5) continue;
    const distance = Math.max(platform.x - point.x, point.x - end, 0);
    if (!distance) { if (before(platform, exact)) exact = platform; }
    else if (distance <= tolerance && (!edge || platform.y < edge.y || platform.y === edge.y && (distance < edgeDistance || distance === edgeDistance && before(platform, edge)))) { edge = platform; edgeDistance = distance; }
  }
  return exact ?? edge;
}

/** A deliberate drop can start below the viewport's protected floor, notably
 * beside fixed month controls. After first-contact landing finds nothing,
 * recover only that real floor on the same vertical ray. Never attract to a
 * different column, house floor, or a card/date above the user's release. */
export function companionViewportFloorAbove(point: Readonly<{ x: number; y: number }>, platforms: readonly Platform[]): Platform | undefined {
  if (![point.x, point.y].every(Number.isFinite)) return undefined;
  let nearest: Platform | undefined;
  for (const platform of platforms) {
    const end = platform.x + platform.width;
    if (platform.kind !== "floor" || !/^viewport-floor(?:-\d+)?$/.test(platform.id)
      || ![platform.x, platform.y, platform.width, end].every(Number.isFinite) || platform.width <= 0
      || platform.y > point.y || point.x < platform.x || point.x > end) continue;
    if (!nearest || platform.y > nearest.y || platform.y === nearest.y && platform.id < nearest.id) nearest = platform;
  }
  return nearest;
}

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
