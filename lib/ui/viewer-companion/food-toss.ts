import { platformLandingX, type CompanionFood, type Platform } from "./brain";
import { isCompanionFoodBedSupport, isCompanionHomeFloorFoodSupport, isCompanionViewportFloorFoodSupport, type CompanionFoodDropSupport } from "./food";
import { compareCompanionItemLandings, rankCompanionItemLandings, type CompanionItemPoint } from "./item-landing";

type Point = Readonly<{ x: number; y: number }>;
const finite = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y);
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
export const COMPANION_FOOD_TOSS_GRAVITY = 1800;

/** One bounded real throw. Test the descending parabola against physical card
 * tops, then slide only within that same card's protected input span. A miss
 * never fabricates a floor across controls or pulls food onto the sofa. */
function planFoodToss(food: CompanionFood, awayFrom: Point, strength: number, supports: readonly CompanionFoodDropSupport[], viewport: Readonly<{ width: number; height: number }>, aim?: Point, limitAim = false) {
  if (!finite(food) || !finite(awayFrom) || ![viewport.width, viewport.height].every(Number.isFinite)
    || viewport.width < 48 || viewport.height < 48 || food.x < 24 || food.x > viewport.width - 24 || food.y < 12 || food.y > viewport.height) return;
  const force = Number.isFinite(strength) ? clamp(strength, 1, 3) : 1;
  const height = Math.min(18 + force * 12, food.y - 8), gravity = COMPANION_FOOD_TOSS_GRAVITY;
  const vy = -Math.sqrt(2 * gravity * height), apex = food.y - height;
  // A known home contact ends this flight. The viewport below that floor is
  // not extra air time that should throttle an outlet only18px above ground.
  // Ordinary throws keep their existing viewport horizon and speed policy.
  const horizonDelta = limitAim && aim ? aim.y - food.y : Math.max(0, viewport.height - food.y);
  const horizonDiscriminant = vy * vy + 2 * gravity * horizonDelta;
  if (!Number.isFinite(horizonDiscriminant) || horizonDiscriminant < 0) return;
  const horizon = (-vy + Math.sqrt(horizonDiscriminant)) / gravity;
  if (!Number.isFinite(horizon) || horizon <= 0) return;
  const direction = food.x < awayFrom.x ? -1 : 1;
  // Bound the entire flight, not just its final drawing, to native food input
  // margins. A wall reduces horizontal speed instead of teleporting the fruit.
  const speed = direction * Math.min(90 + force * 45, 140 / Math.max(.1, horizon));
  let horizontalSpeed = speed;
  if (aim) {
    const seconds = (-vy + Math.sqrt(vy * vy + 2 * gravity * (aim.y - food.y))) / gravity;
    if (!finite(aim) || !Number.isFinite(seconds) || seconds <= 0) return;
    horizontalSpeed = (aim.x - food.x) / seconds;
    if (!Number.isFinite(horizontalSpeed)) return;
    if (Math.abs(horizontalSpeed) > Math.abs(speed)) {
      if (!limitAim) return;
      horizontalSpeed = clamp(horizontalSpeed, -Math.abs(speed), Math.abs(speed));
    }
  }
  const vx = clamp(horizontalSpeed, (24 - food.x) / horizon, (viewport.width - 24 - food.x) / horizon);
  let chosen: { food: CompanionFood; contactX: number; height: number; seconds: number; distance: number; floor: boolean } | undefined;
  for (const support of supports) {
    if (!support.id || isCompanionFoodBedSupport(support.id) || ![support.x, support.y, support.width, support.x + support.width].every(Number.isFinite)
      || support.width <= 0 || support.y < apex || support.y < 8 || support.y > viewport.height - 12) continue;
    if (isCompanionViewportFloorFoodSupport(support.id) && (support.kind !== "floor" || support.y < viewport.height * .65 - 8 || support.x < 0 || support.x + support.width > viewport.width)) continue;
    const safeLeft = Math.max(24, support.x), safeRight = Math.min(viewport.width - 24, support.x + support.width);
    if (safeRight < safeLeft) continue;
    const surface = support.kind === "card" ? support.dropSurface : undefined;
    const validSurface = surface && [surface.x, surface.width, surface.x + surface.width].every(Number.isFinite) && surface.width > 0
      && support.x >= surface.x - .5 && support.x + support.width <= surface.x + surface.width + .5;
    const left = validSurface ? surface.x : support.x, right = validSurface ? surface.x + surface.width : support.x + support.width;
    const seconds = (-vy + Math.sqrt(vy * vy + 2 * gravity * (support.y - food.y))) / gravity;
    if (!Number.isFinite(seconds) || seconds <= 0) continue;
    const contactX = food.x + vx * seconds;
    if (contactX < left || contactX > right) continue;
    const x = clamp(contactX, safeLeft, safeRight), distance = Math.abs(x - contactX);
    const floor = support.kind === "floor";
    if (!chosen || seconds < chosen.seconds || seconds === chosen.seconds && (floor !== chosen.floor ? !floor
      : distance < chosen.distance || distance === chosen.distance && support.id < (chosen.food.platformId ?? ""))) {
      chosen = { food: { id: food.id, kind: food.kind, x, y: support.y, platformId: support.id }, contactX, height, seconds, distance, floor };
    }
  }
  return chosen;
}

export function planCompanionFoodToss(food: CompanionFood, awayFrom: Point, strength: number, supports: readonly CompanionFoodDropSupport[], viewport: Readonly<{ width: number; height: number }>) {
  return planFoodToss(food, awayFrom, strength, supports, viewport);
}

/** A human click emits at the actual outlet, never on a guessed tray. Rank
 * only existing room-floor centres; the same parabola must prove that floor
 * is its first physical contact before a reservation can be adopted. */
export function planCompanionHomeFoodEjection(food: CompanionFood, supports: readonly CompanionFoodDropSupport[], viewport: Readonly<{ width: number; height: number }>, occupied: readonly CompanionItemPoint[] = [], petSupports?: readonly Platform[]) {
  const measured = supports.slice(0, 200);
  const nativeFloors = measured.filter(p => p.kind === "floor" && isCompanionHomeFloorFoodSupport(p.id));
  const bodies = petSupports?.slice(0, 200).filter(p => p.kind === "floor" && p.manualOnly && /^companion-home-floor(?:-\d+)?$/.test(p.id)
    && [p.x, p.y, p.width].every(Number.isFinite) && p.width > 0);
  // A human release retains its smaller physical spans. Only a new system
  // emission also proves a same-plane92px stance within the existing36px mouth
  // range, so a free but isolated44px gap cannot attract the packing planner.
  const floors = bodies ? nativeFloors.flatMap(p => bodies.filter(b => Math.abs(b.y - p.y) <= .5).flatMap(b => {
    const left = Math.max(p.x, platformLandingX(b, b.x) - 36), right = Math.min(p.x + p.width, platformLandingX(b, b.x + b.width) + 36);
    return right >= left ? [{ ...p, x: left, width: right - left }] : [];
  })) : nativeFloors;
  let best: ReturnType<typeof planFoodToss>, score: ReturnType<typeof rankCompanionItemLandings>[number] | undefined;
  for (const target of rankCompanionItemLandings(floors, food.x, occupied)) {
    const away = { x: food.x + (food.x - target.x), y: food.y };
    for (const strength of [1, 2, 3]) {
      // A distant empty slot can lie beyond the existing ejection speed.
      // Evaluate its real reachable edge too, never skip straight to a packed
      // centre or raise the physical speed cap to reach the suggestion.
      const plan = planFoodToss(food, away, strength, measured, viewport, target, true);
      if (!plan || !isCompanionHomeFloorFoodSupport(plan.food.platformId) || Math.abs(plan.food.y - target.y) > .5) continue;
      if (bodies && !bodies.some(b => Math.abs(b.y - plan.food.y) <= .5 && Math.abs(platformLandingX(b, plan.food.x) - plan.food.x) <= 36)) continue;
      const ranked = rankCompanionItemLandings([{ id: plan.food.platformId!, x: plan.food.x, y: plan.food.y, width: 0 }], food.x, occupied)[0];
      if (ranked && (!score || compareCompanionItemLandings(ranked, score) < 0)) { best = plan; score = ranked; }
    }
  }
  return best;
}

/** The real outlet can sit over a protected control gap. Eject toward the
 * creature's actual safe stance only when the first descending contact is a
 * measured room floor within mouth reach. A missing recipient is not license
 * to drop through the house or fabricate a floor across its controls. */
export function planCompanionDispenserEjection(food: CompanionFood, recipient: Point, supports: readonly CompanionFoodDropSupport[], viewport: Readonly<{ width: number; height: number }>) {
  if (!finite(recipient) || recipient.x < 24 || recipient.x > viewport.width - 24 || recipient.y < 12 || recipient.y > viewport.height - 12) return;
  const awayFrom = { x: food.x + (food.x - recipient.x), y: food.y };
  const measured = supports.slice(0, 200);
  const receive = (plan: ReturnType<typeof planFoodToss>) => {
    if (!plan || !isCompanionHomeFloorFoodSupport(plan.food.platformId)) return;
    const floor = measured.find(support => support.id === plan.food.platformId);
    if (floor?.kind === "floor" && Math.abs(plan.food.y - recipient.y) <= .5 && Math.abs(plan.food.x - recipient.x) <= 36) return plan;
  };
  // Preserve existing successful spills. A tall outlet over a nearby stance
  // may otherwise overshoot even at minimum throw strength. Aim only this
  // dispenser flight, retaining the same speed bound and first-contact proof.
  for (const aim of [undefined, recipient]) for (const strength of [1, 2, 3]) {
    const accepted = receive(planFoodToss(food, awayFrom, strength, measured, viewport, aim));
    if (accepted) return accepted;
  }
}
