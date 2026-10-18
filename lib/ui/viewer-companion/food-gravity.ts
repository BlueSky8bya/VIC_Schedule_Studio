import { COMPANION_FOOD_TOSS_GRAVITY } from "./food-toss";

type Point = Readonly<{ x: number; y: number }>;
export type CompanionFoodGravitySample = { x: number; y: number; scale: number; scaleX: number; scaleY: number; rotation: number; active: boolean };
const finite = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y);
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** One finite analytic fall, followed by a small impact and one bounce. Target
 * translation carries the entire flight without restarting its clock, so a
 * real DOM/document anchor can scroll underneath the same authored motion. */
export function createCompanionFoodGravity(from: Point, to: Point, started: number, options?: Readonly<{ contactX?: number; recoverAboveFloor?: boolean }>) {
  const origin = finite(from) ? { ...from } : { x: 0, y: 0 };
  const validEnd = finite(to) && Number.isFinite(to.y - origin.y) && Number.isFinite(to.x - origin.x);
  const recovering = validEnd && to.y < origin.y && options?.recoverAboveFloor === true;
  const target = validEnd && (to.y >= origin.y || recovering) ? { ...to } : { ...origin };
  const distance = target.y - origin.y;
  const moving = Math.hypot(target.x - origin.x, distance) >= .5;
  const fall = moving && !recovering ? clamp(Math.sqrt(2 * distance / 1800) * 1000, 90, 1200) : 0;
  const duration = moving ? recovering ? clamp(Math.sqrt(2 * -distance / 1800) * 1000, 140, 420) : fall + 240 : 0;
  const began = Number.isFinite(started) ? started : 0;
  const contactX = typeof options?.contactX === "number" && Number.isFinite(options.contactX) ? clamp(options.contactX, Math.min(origin.x, target.x), Math.max(origin.x, target.x)) : target.x;
  return {
    duration,
    sample(now: number, currentTarget: Point = target): CompanionFoodGravitySample {
      const validTarget = finite(currentTarget) && [currentTarget.x - target.x, currentTarget.y - target.y, origin.x + (currentTarget.x - target.x), origin.y + (currentTarget.y - target.y)].every(Number.isFinite);
      const end = validTarget ? currentTarget : target;
      const age = Number.isFinite(now) ? Math.max(0, now - began) : duration;
      const result = { x: end.x, y: end.y, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, active: moving && age < duration };
      if (!result.active) return result;
      if (recovering) {
        // A real pointer can pass below the protected floor beside a fixed
        // toolbar. Return monotonically onto that already measured safe span
        // rather than teleporting, bouncing through a control or manufacturing
        // an upward card fall. Scrolling carries this same finite clock.
        const p = age / duration, eased = p * p * (3 - 2 * p);
        result.x = origin.x + (end.x - target.x) + (target.x - origin.x) * eased;
        result.y = origin.y + (end.y - target.y) + distance * eased;
        return result;
      }
      if (age < fall) {
        const p = (age / fall) ** 2;
        result.x = origin.x + (end.x - target.x) + (contactX - origin.x) * p;
        result.y = origin.y + (end.y - target.y) + distance * p;
      } else {
        const impact = age - fall;
        const slide = Math.min(1, impact / 160), eased = slide * slide * (3 - 2 * slide);
        result.x = contactX + (end.x - target.x) + (target.x - contactX) * eased;
        if (impact < 80) {
          const squash = Math.sin(impact / 80 * Math.PI);
          result.scaleX += squash * .10; result.scaleY -= squash * .13;
        } else {
          const bounce = Math.sin((impact - 80) / 160 * Math.PI);
          result.y -= Math.min(4, distance * .025) * bounce;
          result.scaleX -= bounce * .02; result.scaleY += bounce * .035;
        }
      }
      return result;
    },
  };
}

/** Same finite sampler contract as an ordinary drop. Logical support changes
 * once at release; drawing follows one parabola and a short protected slide. */
export function createCompanionFoodToss(from: Point, to: Point, started: number, options: Readonly<{ height: number; contactX: number }>) {
  const height = Number.isFinite(options.height) ? clamp(options.height, 0, 64) : 0;
  const gravity = COMPANION_FOOD_TOSS_GRAVITY, vy = -Math.sqrt(2 * gravity * height);
  const discriminant = vy * vy + 2 * gravity * (to.y - from.y);
  if (!finite(from) || !finite(to) || !Number.isFinite(discriminant) || discriminant < 0 || !Number.isFinite(options.contactX) || height <= 0) return createCompanionFoodGravity(from, from, started);
  const seconds = (-vy + Math.sqrt(discriminant)) / gravity;
  if (!Number.isFinite(seconds) || seconds <= 0) return createCompanionFoodGravity(from, from, started);
  const fall = clamp(seconds * 1000, 90, 1400), duration = fall + 240;
  const origin = { ...from }, target = { ...to }, began = Number.isFinite(started) ? started : 0;
  const contactX = options.contactX, direction = Math.sign(contactX - from.x) || 1;
  return { duration, sample(now: number, currentTarget: Point = target): CompanionFoodGravitySample {
    const shifted = finite(currentTarget) && [currentTarget.x - target.x, currentTarget.y - target.y].every(Number.isFinite);
    const end = shifted ? currentTarget : target, dx = end.x - target.x, dy = end.y - target.y;
    const age = Number.isFinite(now) ? Math.max(0, now - began) : duration;
    const result = { x: end.x, y: end.y, scale: 1, scaleX: 1, scaleY: 1, rotation: 0, active: age < duration };
    if (!result.active) return result;
    if (age < fall) {
      const p = age / fall, time = seconds * p;
      result.x = origin.x + dx + (contactX - origin.x) * p;
      result.y = origin.y + dy + vy * time + gravity * time * time / 2;
      result.rotation = direction * Math.sin(p * Math.PI) * 28;
    } else {
      const impact = age - fall, slide = Math.min(1, impact / 160), eased = slide * slide * (3 - 2 * slide);
      result.x = contactX + dx + (target.x - contactX) * eased;
      if (impact < 80) { const squash = Math.sin(impact / 80 * Math.PI); result.scaleX += squash * .1; result.scaleY -= squash * .13; }
      else { const bounce = Math.sin((impact - 80) / 160 * Math.PI); result.y -= 3 * bounce; result.scaleX -= bounce * .02; result.scaleY += bounce * .035; }
    }
    return result;
  } };
}
