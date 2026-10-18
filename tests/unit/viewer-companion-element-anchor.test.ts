import { describe, expect, it, vi } from "vitest";
import { attachCompanionElementPoint, companionLayoutMotionMs, companionSupportPointDelta, followCompanionElementPoint } from "@/lib/ui/viewer-companion/element-anchor";

const rect = { left: 100.25, top: 200.125, width: 320.5, height: 180.75 };
describe("121 native element anchors", () => {
  it("keeps native fractions through fractional translation, zoom and restoration", () => {
    const point = { x: rect.left + rect.width * .37, y: rect.top + rect.height * .4 };
    const attached = attachCompanionElementPoint(point, rect)!;
    const moved = { left: 700.75, top: 30.375, width: rect.width * .83, height: rect.height * .83 };
    const followed = followCompanionElementPoint(attached, moved)!;
    expect(followed.x).toBeCloseTo(moved.left + moved.width * .37, 12);
    expect(followed.y).toBeCloseTo(moved.top + moved.height * .4, 12);
    expect(followCompanionElementPoint(attached, rect)).toEqual(point);
  });
  it("preserves CSS-pixel clearance at real top and bottom edges", () => {
    const changed = { ...rect, left: 800.125, top: 40.25, width: 256.4, height: 144.6 };
    for (const [y, expected] of [[rect.top - 3, changed.top - 3], [rect.top, changed.top], [rect.top + rect.height - 3, changed.top + changed.height - 3]]) {
      const attached = attachCompanionElementPoint({ x: rect.left + rect.width / 2, y }, rect)!;
      expect(followCompanionElementPoint(attached, changed)).toEqual({ x: changed.left + changed.width / 2, y: expected });
    }
  });
  it("projects each journey endpoint at its own native fraction without quantizing small moves", () => {
    const next = { ...rect, left: rect.left + .125, top: rect.top - .0625, width: rect.width * 1.2 };
    const a = { x: rect.left + rect.width * .2, y: 380 }, b = { x: rect.left + rect.width * .8, y: 380 };
    const da = companionSupportPointDelta(a, rect, next, -.0625), db = companionSupportPointDelta(b, rect, next, -.0625);
    expect(a.x + da.x).toBeCloseTo(next.left + next.width * .2, 12);
    expect(b.x + db.x).toBeCloseTo(next.left + next.width * .8, 12);
    expect(da.x).not.toBe(db.x); expect(da.y).toBe(-.0625);
    expect(companionSupportPointDelta(a, rect, { ...rect, left: rect.left + .001 }, .001)).toMatchObject({ y: .001 });
  });
  it("rejects invalid native frames instead of inventing a support", () => {
    for (const invalid of [{ ...rect, width: 0 }, { ...rect, height: -1 }, { ...rect, left: NaN }, { ...rect, top: Infinity }]) {
      expect(attachCompanionElementPoint({ x: 200, y: 300 }, invalid)).toBeUndefined();
      expect(followCompanionElementPoint({ u: .5, v: 0, vertical: "top" }, invalid)).toBeUndefined();
      expect(companionSupportPointDelta({ x: 200, y: 300 }, rect, invalid, 0)).toEqual({ x: 0, y: 0 });
    }
  });
});

describe("121 event-owned finite layout following", () => {
  const target = {} as Element;
  const owner = { contains: (element: Element) => element === target } as Element;
  const event = (type: string, element: Element, ms: number) => ({ type, detail: { element, ms } }) as CustomEvent;
  it("uses the actual shared motion duration only for affected native anchors", () => {
    expect(companionLayoutMotionMs(event("vic:layout-motion", owner, 1800), [target], 520)).toBe(1800);
    expect(companionLayoutMotionMs(event("vic:layout-motion", owner, 1800), [], 520)).toBe(0);
    for (const ms of [NaN, Infinity, -1, 0, 10_001]) expect(companionLayoutMotionMs(event("vic:layout-motion", owner, ms), [target], 520)).toBe(0);
    expect(companionLayoutMotionMs({ type: "scroll" } as Event, [target], 180)).toBe(180);
  });
  it("reads finite native CSS/WAAPI time once per relevant start event, excluding infinite and paused animations", () => {
    const animations: unknown[] = [];
    const element = { contains: (node: Element) => node === target, getAnimations: vi.fn(() => animations) } as unknown as Element;
    const animation = (endTime: number, currentTime: number, playState = "running", animatedTarget = element) => ({ currentTime, playState, effect: { target: animatedTarget, getComputedTiming: () => ({ endTime }) } });
    animations.push(animation(Infinity, 0), animation(2400, 400), animation(6000, 0, "paused"), animation(8000, 0, "running", target));
    expect(companionLayoutMotionMs({ type: "animationstart", target: element } as unknown as Event, [target], 520)).toBe(2000);
    expect(element.getAnimations).toHaveBeenCalledTimes(1);
    expect(companionLayoutMotionMs({ type: "transitionrun", target: element } as unknown as Event, [], 520)).toBe(0);
    expect(element.getAnimations).toHaveBeenCalledTimes(1);
  });
});
