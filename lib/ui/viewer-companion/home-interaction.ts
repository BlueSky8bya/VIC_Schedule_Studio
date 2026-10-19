import { COMPANION_JUMP_LIMITS, nearestPlatform, platformLandingX, type Platform } from "./brain";
import { nearestVerticalCompanionSupport } from "./support-landing";

type Point = Readonly<{ x: number; y: number }>;
export const COMPANION_WASH_SUPPORT = "companion-home-floor-400";
const floor = (id: string) => /^companion-home-floor(?:-\d+)?$/.test(id);

/** Reach the nearest real rim when storage itself excludes the body from
 * standing under its centre. Delivered items still target the opening centre. */
export function companionHomeOpeningContact(rect: { left: number; right: number; bottom: number; width: number }, actorX: number): Point | undefined {
  if (![rect.left, rect.right, rect.bottom, rect.width, actorX].every(Number.isFinite) || rect.width <= 0 || rect.right <= rect.left) return;
  const inset = Math.min(1, rect.width / 4);
  return { x: Math.max(rect.left + inset, Math.min(rect.right - inset, actorX)), y: rect.bottom };
}

/** A wash mat is a measured body stance, not the back/bottom room plane.
 * A later geometry delivery must retain that exact identity and height. */
export function companionHomeResidentFloor(id: string, point: Point, platforms: readonly Platform[], floorY: number): Platform | undefined {
  if (![point.x, point.y, floorY].every(Number.isFinite)) return;
  const floors = platforms.filter(p => floor(p.id) && p.width > 0 && [p.x, p.y, p.width].every(Number.isFinite));
  if (id === COMPANION_WASH_SUPPORT) return floors.find(p => p.id === id && p.bodyOnly);
  const ordinary = floors.filter(p => !p.bodyOnly);
  return nearestVerticalCompanionSupport({ x: point.x, y: floorY }, ordinary) ?? nearestPlatform(point, ordinary);
}

/** A finite reach rises and returns on the existing action clock. The body
 * remains below the real ceiling; an out-of-reach control cannot receive ACK. */
export function sampleCompanionHomeReach(input: { hand: Point; contact: Point; footY: number; ceiling: number; size: number; progress: number; jump: boolean }) {
  const { hand, contact, footY, ceiling, size } = input;
  if (![hand.x, hand.y, contact.x, contact.y, footY, ceiling, size, input.progress].every(Number.isFinite) || size <= 0) return;
  const p = Math.max(0, Math.min(1, input.progress));
  const phase = Math.min(1, p / .28, (1 - p) / .22);
  const envelope = phase * phase * (3 - 2 * phase);
  const room = Math.max(0, footY - ceiling - size * .72);
  const wanted = Math.max(0, hand.y - contact.y - size * .2);
  const lift = input.jump ? Math.min(COMPANION_JUMP_LIMITS.maxRise, room, wanted) * envelope : 0;
  const from = { x: hand.x, y: hand.y - lift };
  const reachable = Math.hypot(from.x - contact.x, from.y - contact.y) <= size * .48;
  const touching = reachable && p >= .32 && p <= .76;
  return { lift, from, to: touching ? contact : from, touching };
}

export function companionRoomBodyLight(point: Point, room: { left: number; right: number; top: number; bottom: number } | undefined, grade: number): number {
  if (!room || ![point.x, point.y, room.left, room.right, room.top, room.bottom, grade].every(Number.isFinite)) return 1;
  return point.x >= room.left && point.x <= room.right && point.y >= room.top && point.y <= room.bottom
    ? Math.max(.35, Math.min(1, grade)) : 1;
}

export function companionHomeResidentPoint(platform: Platform, x: number) {
  return { x: platformLandingX(platform, x), y: platform.y };
}
