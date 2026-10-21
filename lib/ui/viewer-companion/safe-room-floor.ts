import type { CompanionWorld, Platform } from "./brain";

/** Geometry-owned body-safe room spans only. Numbered spans are split from
 * the same painted floor; deliberate bath/food/control stances never roam. */
export function companionOrdinaryRoomFloor(platform: Platform | undefined): platform is Platform {
  return Boolean(platform && /^companion-home-floor(?:-\d+)?$/.test(platform.id)
    && platform.id !== "companion-home-floor-400" && platform.kind === "floor" && !platform.bodyOnly
    && [platform.x, platform.y, platform.width].every(Number.isFinite) && platform.width > 0);
}

/** A finite same-span step, resolved once at an actual decision boundary.
 * Returning the measured endpoint does not certify an arrival or progress. */
export function companionLocalFloorStep(world: CompanionWorld, preferredDirection = 1) {
  const support = world.platforms.find(platform => platform.id === world.platformId);
  if (!support || support.bodyOnly || ["control", "hide"].includes(support.kind)
    || support.manualOnly && !companionOrdinaryRoomFloor(support)
    || ![world.x, world.y, support.x, support.y, support.width].every(Number.isFinite)
    || Math.abs(world.y - support.y) > 2 || world.x < support.x || world.x > support.x + support.width) return;
  const inset = Math.min(12, support.width / 4), left = support.x + inset, right = support.x + support.width - inset;
  const direction = preferredDirection < 0 ? -1 : 1;
  const candidates = [direction * 72, -direction * 72, direction * 48, -direction * 48]
    .map(distance => Math.max(left, Math.min(right, world.x + distance)));
  const x = candidates.find(value => Math.abs(value - world.x) >= 24);
  return x === undefined ? undefined : { x, y: support.y, platformId: support.id };
}
