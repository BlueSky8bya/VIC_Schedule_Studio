import { COMPANION_JUMP_LIMITS, nearestPlatform, platformLandingX, type Platform } from "./brain";
import { nearestVerticalCompanionSupport } from "./support-landing";

type Point = Readonly<{ x: number; y: number; width?: number; height?: number }>;
export const COMPANION_WASH_SUPPORT = "companion-home-floor-400";
const floor = (id: string) => /^companion-home-floor(?:-\d+)?$/.test(id);

/** Feet stay inside the real mat; the body also needs room at the wall. In a
 * narrow rail the mat centre can miss that clearance by only two pixels.
 * Choose the nearest valid part of the same mat, never an unrelated floor. */
export function companionWashMatStance(mat: { left: number; top: number; width: number; height: number }, room: { left: number; right: number; top: number; bottom: number }, size: number): Point | undefined {
  if (![mat.left, mat.top, mat.width, mat.height, room.left, room.right, room.top, room.bottom, size].every(Number.isFinite) || mat.width <= 0 || mat.height <= 0 || size <= 0) return;
  const y = mat.top + mat.height * .72;
  const left = Math.max(mat.left + mat.width * .18, room.left + size * .38), right = Math.min(mat.left + mat.width * .82, room.right - size * .38);
  if (right < left || y < room.top || y >= room.bottom) return;
  return { x: Math.max(left, Math.min(right, mat.left + mat.width / 2)), y };
}

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

/** A finite reach rises and returns on the existing action clock. Room art
 * grows beyond its260px default while the actor stays92px. Scale this local
 * control hop to the actual hand/handle gap. This is a same-support reach,
 * bounded by the measured ceiling, not an ordinary platform transfer. */
export function sampleCompanionHomeReach(input: { hand: Point; contact: Point; footY: number; ceiling: number; size: number; progress: number; jump: boolean; cord?: boolean }) {
  const { hand, contact, footY, ceiling, size } = input;
  if (![hand.x, hand.y, contact.x, contact.y, footY, ceiling, size, input.progress].every(Number.isFinite) || size <= 0) return;
  const p = Math.max(0, Math.min(1, input.progress));
  const phase = Math.min(1, p / .28, (1 - p) / .22);
  const envelope = phase * phase * (3 - 2 * phase);
  const room = Math.max(0, footY - ceiling - size * .72);
  const cord = input.cord === true;
  const wanted = Math.max(0, hand.y - contact.y - (cord ? 0 : size * .2));
  const controlRise = cord ? room : COMPANION_JUMP_LIMITS.maxRise * Math.max(1, (footY - ceiling) / 260);
  const lift = input.jump ? Math.min(controlRise, room, wanted) * envelope : 0;
  const from = { x: hand.x, y: hand.y - lift };
  const reachable = cord ? companionHomeCordTouches(from, contact, size) : Math.hypot(from.x - contact.x, from.y - contact.y) <= size * .48;
  const touching = reachable && p >= .32 && p <= .76;
  return { lift, from, to: touching ? contact : from, touching };
}

/** Adjacent authored hand anchors vary by about1.5px at the normal92px size.
 * A body-width proximity is not physical hand-to-control contact. */
export function companionHomeContactTolerance(size: number) {
  return Math.max(2, size * .03);
}

/** The knob is a real rectangle, not a zero-size centre. Its edge can touch
 * the calibrated opaque3x3 source patch without their centres coinciding. */
export function companionHomeCordTouches(hand: Point, contact: Point, size: number) {
  if (![hand.x, hand.y, contact.x, contact.y, size].every(Number.isFinite) || size <= 0) return false;
  if (contact.width !== undefined || contact.height !== undefined) {
    if (!Number.isFinite(contact.width) || !Number.isFinite(contact.height) || contact.width! <= 0 || contact.height! <= 0) return false;
    return Math.hypot(Math.max(0, Math.abs(hand.x - contact.x) - contact.width! / 2),
      Math.max(0, Math.abs(hand.y - contact.y) - contact.height! / 2)) <= Math.max(1, size / 80);
  }
  return Math.hypot(hand.x - contact.x, hand.y - contact.y) <= companionHomeContactTolerance(size);
}

export function companionRoomBodyLight(point: Point, room: { left: number; right: number; top: number; bottom: number } | undefined, grade: number): number {
  if (!room || ![point.x, point.y, room.left, room.right, room.top, room.bottom, grade].every(Number.isFinite)) return 1;
  return point.x >= room.left && point.x <= room.right && point.y >= room.top && point.y <= room.bottom
    ? Math.max(.35, Math.min(1, grade)) : 1;
}

export function companionHomeResidentPoint(platform: Platform, x: number) {
  return { x: platformLandingX(platform, x), y: platform.y };
}
