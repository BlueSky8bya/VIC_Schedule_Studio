import { COMPANION_FOOD_KINDS, type CompanionFoodKind } from "./snacks";
import { COMPANION_TOY_KINDS, type CompanionToyKind } from "./toy-catalog";
import { COMPANION_BEHAVIOR_IDS, type CompanionBehaviorId } from "./collection";
import { COMPANION_SITUATION_IDS, type CompanionSituationId } from "./moments";

type Point = Readonly<{ x: number; y: number }>;
/** An already committed first discovery. This presentation never records it. */
export type CompanionDiscoveryNotice = Readonly<{ serial: number; source: Point }> & (
  { kind: "food"; id: CompanionFoodKind } | { kind: "toy"; id: CompanionToyKind }
  | { kind: "behavior"; id: CompanionBehaviorId } | { kind: "moment"; id: CompanionSituationId }
);
const finite = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y);
export function validCompanionDiscoveryNotice(notice: CompanionDiscoveryNotice) {
  if (!Number.isSafeInteger(notice.serial) || notice.serial <= 0 || !finite(notice.source)) return false;
  const ids: readonly string[] = notice.kind === "food" ? COMPANION_FOOD_KINDS : notice.kind === "toy" ? COMPANION_TOY_KINDS : notice.kind === "behavior" ? COMPANION_BEHAVIOR_IDS : notice.kind === "moment" ? COMPANION_SITUATION_IDS : [];
  return ids.includes(notice.id);
}

/** Constant memory: stale completions cannot clear a newer notice, and a
 * repeated serial cannot replay after pause, quiet-mode change or rerender. */
export function createCompanionDiscoveryFlightGate() {
  let last = 0, current: number | null = null;
  return {
    accept(serial: number) { if (!Number.isSafeInteger(serial) || serial <= last) return false; last = serial; current = serial; return true; },
    finish(serial: number) { if (current !== serial) return false; current = null; return true; },
    current: () => current,
  };
}

/** The existing first-food arc, shared by actual toy and behavior discoveries.
 * No visible book means a local fade, never a fabricated destination. */
export function companionDiscoveryFlightPlan(source: Point, destination: Point | undefined, quiet: boolean) {
  if (!finite(source) || destination && !finite(destination)) return undefined;
  const stationary = quiet || !destination, end = stationary ? source : destination!;
  const transform = (point: Point, scale: number) => `translate3d(${point.x - 24}px,${point.y - 24}px,0) scale(${stationary ? 1 : scale})`;
  const frames: Keyframe[] = [
    { opacity: 0, transform: transform(source, 1.3) },
    { opacity: 1, transform: transform({ x: source.x, y: source.y - (stationary ? 0 : 36) }, 1), offset: .28 },
    { opacity: 1, transform: transform(end, .55), offset: .85 },
    { opacity: 0, transform: transform(end, .45) },
  ];
  return { frames, duration: stationary ? 600 : 1500, stationary };
}
