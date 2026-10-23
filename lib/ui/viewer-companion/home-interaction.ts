import { COMPANION_JUMP_LIMITS, nearestPlatform, platformLandingX, type Platform } from "./brain";
import { nearestVerticalCompanionSupport } from "./support-landing";

type Point = Readonly<{ x: number; y: number; width?: number; height?: number }>;
export type CompanionHomeCordAnchor = "top" | "left" | "right";
/** Use an existing opaque part that is actually beneath this handle. A room
 * can put the same cord beside OR directly above the safe floor stance.
 * Selecting a side merely from facing misses the latter by half a body.
 * The owner pins this choice for its finite action, avoiding pose-height
 * jumps when neighbouring source cells differ by a fraction of a pixel. */
export function nearestCompanionHomeCordAnchor(candidates: readonly { anchor: CompanionHomeCordAnchor; point: Point }[], contact: Point): CompanionHomeCordAnchor | undefined {
  if (![contact.x,contact.y].every(Number.isFinite)) return;
  return candidates.filter(candidate => [candidate.point.x,candidate.point.y].every(Number.isFinite))
    .reduce<{ anchor: CompanionHomeCordAnchor; distance: number } | undefined>((best,candidate) => {
      const distance=Math.abs(candidate.point.x-contact.x);
      return !best || distance < best.distance ? { anchor:candidate.anchor,distance } : best;
    },undefined)?.anchor;
}
/** Both hanging controls use the actual painted knob rectangle. The long
 * rope/button hit target must never stand in for the small handle below it. */
export function companionHomeCordPoint(rect: { left: number; top: number; width: number; height: number }): Point | undefined {
  if (![rect.left,rect.top,rect.width,rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return;
  return { x: rect.left+rect.width/2, y: rect.top+rect.height/2, width: rect.width, height: rect.height };
}
/** A wall-side handle is nudged with the existing side of the body. Standing
 * the actor centre directly on that handle can put half its silhouette outside
 * the room. Approach on an actual floor with the same opaque-body clearance
 * used by room geometry, leaving the source09 side patch beside the handle.
 * The window/looking stance itself is unchanged. */
export function companionCurtainControlStance(contact: Point, room: { left: number; right: number }, platforms: readonly Platform[], size: number) {
  if (![contact.x,contact.y,room.left,room.right,size].every(Number.isFinite) || size <= 0 || room.right <= room.left) return;
  const bodyHalf=size*.38+3, reach=size*.27;
  const preferred=contact.x-room.left < bodyHalf+reach ? contact.x+reach
    : room.right-contact.x < bodyHalf+reach ? contact.x-reach : contact.x;
  return platforms.flatMap(platform => {
    if (!floor(platform.id) || platform.bodyOnly || ![platform.x,platform.y,platform.width].every(Number.isFinite) || platform.width <= 0) return [];
    const left=Math.max(platformLandingX(platform,platform.x),room.left+bodyHalf), right=Math.min(platformLandingX(platform,platform.x+platform.width),room.right-bodyHalf);
    if (left > right) return [];
    return [{x:Math.max(left,Math.min(right,preferred)),y:platform.y,platformId:platform.id}];
  }).sort((a,b)=>Math.abs(a.x-preferred)-Math.abs(b.x-preferred))[0];
}
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
export function sampleCompanionHomeReach(input: { hand: Point; contact: Point; footY: number; ceiling: number; size: number; progress: number; jump: boolean; cord?: boolean;
  horizontal?: Readonly<{ bodyX: number; left: number; right: number }> }) {
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
  // Centre the registered hand during this same finite hop. Full-renderer
  // lean/row9 anchors otherwise leave a4px knob between one-frame contacts.
  // The measured safe floor/room span owns the actual body shift; no remote
  // reach, instant snap or contact-tolerance change can earn a tug.
  const span = input.horizontal;
  const safe = span && [span.bodyX,span.left,span.right].every(Number.isFinite) && span.left <= span.bodyX && span.bodyX <= span.right;
  const limit = size * .12;
  const offset = cord && input.jump && safe ? Math.max(span.left-span.bodyX,Math.min(span.right-span.bodyX,Math.max(-limit,Math.min(limit,contact.x-hand.x)))) : 0;
  const shiftX = envelope > 0 ? offset * envelope : 0;
  const from = { x: hand.x + shiftX, y: hand.y - lift };
  const reachable = cord ? companionHomeCordTouches(from, contact, size) : Math.hypot(from.x - contact.x, from.y - contact.y) <= size * .48;
  const touching = reachable && p >= .32 && p <= .76;
  return { lift, shiftX, from, to: touching ? contact : from, touching };
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
