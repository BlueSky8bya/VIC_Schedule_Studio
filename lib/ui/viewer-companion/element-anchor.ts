export type CompanionAnchorFrame = Readonly<{ left: number; top: number; width: number; height: number }>;
export type CompanionElementPoint = Readonly<{ u: number; v: number; vertical: "top" | "bottom" | "fraction" }>;
type Point = Readonly<{ x: number; y: number }>;
const valid = (rect: CompanionAnchorFrame) => [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0;

/** Retain the native element fraction, with CSS-pixel clearance at its edges.
 * A resized calendar scales its content, never the pet/food's hit target. */
export function attachCompanionElementPoint(point: Point, rect: CompanionAnchorFrame): CompanionElementPoint | undefined {
  if (!valid(rect) || ![point.x, point.y].every(Number.isFinite)) return;
  const top = point.y - rect.top, bottom = point.y - rect.top - rect.height;
  const vertical = top <= 0 ? "top" : bottom >= -8 ? "bottom" : "fraction";
  return { u: (point.x - rect.left) / rect.width, v: vertical === "top" ? top : vertical === "bottom" ? bottom : top / rect.height, vertical };
}

export function followCompanionElementPoint(point: CompanionElementPoint, rect: CompanionAnchorFrame): Point | undefined {
  if (!valid(rect) || ![point.u, point.v].every(Number.isFinite)) return;
  return { x: rect.left + point.u * rect.width, y: rect.top + (point.vertical === "top" ? point.v : point.vertical === "bottom" ? rect.height + point.v : point.v * rect.height) };
}

/** A world point on a support shares its native horizontal fraction. Vertical
 * carry comes from the measured support plane rather than a cell-height guess. */
export function companionSupportPointDelta(point: Point, from: CompanionAnchorFrame, to: CompanionAnchorFrame, deltaY: number): Point {
  if (!valid(from) || !valid(to) || ![point.x, point.y, deltaY].every(Number.isFinite)) return { x: 0, y: 0 };
  return { x: to.left + (point.x - from.left) / from.width * to.width - point.x, y: deltaY };
}

/** Actual finite CSS/WAAPI lifetime, sampled only on an input/layout event.
 * Infinite ambient animations cannot acquire an anchor-follow lease. */
export function companionLayoutMotionMs(event: Event | undefined, anchors: readonly Element[], fallbackMs: number): number {
  const owns = (element: Element) => Boolean(element && typeof element.contains === "function") && anchors.some(anchor => element === anchor || element.contains(anchor));
  const bounded = (ms: number) => Number.isFinite(ms) && ms > 0 && ms <= 10_000 ? ms : 0;
  if (event?.type === "vic:layout-motion") {
    const detail = (event as CustomEvent<{ element?: Element; ms?: number }>).detail;
    return detail?.element && owns(detail.element) ? bounded(detail.ms ?? 0) : 0;
  }
  if (event?.type === "animationstart" || event?.type === "transitionrun") {
    const element = event.target as Element | null;
    if (!element || !owns(element) || typeof element.getAnimations !== "function") return 0;
    return element.getAnimations().reduce((duration, animation) => {
      if ((animation.effect as KeyframeEffect | null)?.target !== element || animation.playState === "paused" || animation.playState === "finished") return duration;
      return Math.max(duration, bounded(Number(animation.effect?.getComputedTiming().endTime) - Number(animation.currentTime ?? 0)));
    }, 0);
  }
  return bounded(fallbackMs);
}
