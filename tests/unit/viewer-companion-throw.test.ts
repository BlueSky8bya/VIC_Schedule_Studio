import { describe, expect, it } from "vitest";
import type { Platform } from "@/lib/ui/viewer-companion/brain";
import {
  COMPANION_THROW_LIMITS, createCompanionThrow, createCompanionThrowVelocity, stepCompanionThrow,
  type CompanionThrowBounds, type CompanionThrowState,
} from "@/lib/ui/viewer-companion/throw";

const bounds: CompanionThrowBounds = Object.freeze({ left: 50, right: 950, top: 100, bottom: 900 });
const span = (id: string, x: number, y: number, width: number, kind: Platform["kind"] = "card"): Platform => ({ id, x, y, width, kind });
const start = (x = 200, y = 300, vx = 0, vy = 0, box = bounds) => createCompanionThrow({ x, y }, { vx, vy }, box)!;
const finite = (state: CompanionThrowState) => [state.x, state.y, state.vx, state.vy, state.elapsedMs].every(Number.isFinite);

function observeVelocity(hz: number, duration: number, point: (at: number) => { x: number; y: number }) {
  const tracker = createCompanionThrowVelocity(), first = point(0);
  tracker.begin(first.x, first.y, 0);
  for (let now = 1000 / hz; now < duration; now += 1000 / hz) { const p = point(now); tracker.push(p.x, p.y, now); }
  const end = point(duration); tracker.push(end.x, end.y, duration);
  return tracker.release(duration);
}

describe("actual-body release velocity", () => {
  it.each([30, 60, 144, 240])("retains the same timed diagonal impulse at %sHz", hz => {
    const velocity = observeVelocity(hz, 160, at => ({ x: 400 + .6 * at, y: 500 - .3 * at }));
    expect(velocity.vx).toBeCloseTo(600, 9); expect(velocity.vy).toBeCloseTo(-300, 9);
  });
  it("uses the final direction after a real reversal instead of total drag displacement", () => {
    const velocity = observeVelocity(100, 240, at => ({ x: at <= 120 ? 400 + at : 520 - (at - 120) * .5, y: 400 }));
    expect(velocity).toEqual({ vx: -500, vy: 0 });
  });
  it("caps a fast diagonal impulse without changing either sign", () => {
    expect(observeVelocity(100, 80, at => ({ x: 100 - 4 * at, y: 300 + 3 * at }))).toEqual({ vx: -1100, vy: 950 });
  });
  it("does not launch from one point, a still hold or slow deliberate placement", () => {
    const tracker = createCompanionThrowVelocity(); tracker.begin(500, 400, 0);
    expect(tracker.release(50)).toEqual({ vx: 0, vy: 0 });
    expect(observeVelocity(60, 200, () => ({ x: 500, y: 400 }))).toEqual({ vx: 0, vy: 0 });
    expect(observeVelocity(60, 200, at => ({ x: 500 + at * .06, y: 400 - at * .02 }))).toEqual({ vx: 0, vy: 0 });
  });
  it("does not turn a same-millisecond event burst or too-short observation into a throw", () => {
    const tracker = createCompanionThrowVelocity(); tracker.begin(100, 400, 0);
    for (let i = 0; i < 10000; i++) tracker.push(100 + i, 400, 0);
    expect(tracker.release(0)).toEqual({ vx: 0, vy: 0 });
    tracker.begin(100, 400, 0); tracker.push(400, 400, 10);
    expect(tracker.release(10)).toEqual({ vx: 0, vy: 0 });
  });
  it("lets a stationary tail and an input gap discard an earlier impulse", () => {
    const tracker = createCompanionThrowVelocity(); tracker.begin(100, 400, 0); tracker.push(160, 400, 60);
    expect(tracker.release(140)).toEqual({ vx: 0, vy: 0 });
    tracker.begin(100, 400, 0); tracker.push(160, 400, 60);
    expect(tracker.release(141)).toEqual({ vx: 0, vy: 0 });
    tracker.begin(100, 400, 0); tracker.push(160, 400, 60); tracker.push(300, 400, 200);
    expect(tracker.release(200)).toEqual({ vx: 0, vy: 0 });
  });
  it("consumes release, resets on a new hand or invalid input, and ignores retrograde timestamps", () => {
    const tracker = createCompanionThrowVelocity(); tracker.begin(100, 400, 0); tracker.push(160, 400, 60);
    tracker.push(900, 400, 59);
    expect(tracker.release(60)).toEqual({ vx: 1000, vy: 0 }); expect(tracker.release(60)).toEqual({ vx: 0, vy: 0 });
    tracker.begin(100, 400, 0); tracker.push(160, 400, 60); tracker.reset();
    expect(tracker.release(60)).toEqual({ vx: 0, vy: 0 });
    tracker.begin(100, 400, 0); tracker.push(160, 400, 60); tracker.begin(700, 500, 70);
    expect(tracker.release(100)).toEqual({ vx: 0, vy: 0 });
    tracker.begin(100, 400, 0); tracker.push(160, 400, 60); tracker.push(NaN, 400, 70);
    expect(tracker.release(70)).toEqual({ vx: 0, vy: 0 });
  });
  it("does not infer velocity from repeated clamped edge coordinates", () => {
    expect(observeVelocity(240, 300, () => ({ x: bounds.right, y: bounds.top }))).toEqual({ vx: 0, vy: 0 });
  });
});

describe("finite swept projectile flight", () => {
  it("continues from the exact release point, then carries real horizontal and upward velocity", () => {
    const state = start(200, 400, 300, -400);
    expect(stepCompanionThrow(state, 0, [], bounds).state).toBe(state);
    const next = stepCompanionThrow(state, 100, [], bounds);
    expect(next.contact).toBeUndefined(); expect(next.state).toMatchObject({ x: 230, y: 365.5, vx: 300, vy: -290, elapsedMs: 100, done: false });
    expect(state).toEqual(start(200, 400, 300, -400));
  });
  it.each([30, 60, 144])("lands at the same first contact with %sHz increments", hz => {
    // y=300+550*t² reaches y520 at sqrt(.4); x=200+400*t.
    const ledge = span("first", 450, 520, 10), floor = span("floor", 50, 800, 900, "floor");
    let state = start(200, 300, 400), contacts = 0, contactX = 0;
    for (let frames = 0; frames < 300 && !state.done; frames++) {
      const result = stepCompanionThrow(state, 1000 / hz, [floor, ledge], bounds); state = result.state;
      if (result.contact) { contacts++; contactX = result.contact.x; expect(result.contact.platformId).toBe("first"); }
    }
    expect(contacts).toBe(1); expect(contactX).toBeCloseTo(200 + 400 * Math.sqrt(.4), 7);
    expect(state.y).toBe(520); expect(state.elapsedMs).toBeCloseTo(Math.sqrt(.4) * 1000, 7); expect(state.expired).toBe(false);
    expect(stepCompanionThrow(state, 500, [ledge], bounds)).toEqual({ state });
  });
  it("sweeps a narrow ledge even when both display endpoints lie beyond it", () => {
    const result = stepCompanionThrow(start(200, 300, 400), 1000, [span("narrow", 452.9, 520, .2), span("lower", 50, 850, 900)], bounds);
    expect(result.contact?.platformId).toBe("narrow"); expect(result.contact?.x).toBeCloseTo(452.9822128, 6);
    expect(result.state.elapsedMs).toBeLessThan(1000);
  });
  it("passes a platform upward and lands only on its descending crossing", () => {
    const ledge = span("upper", 50, 250, 900), state = start(200, 400, 100, -800);
    const first = stepCompanionThrow(state, 300, [ledge], bounds);
    expect(first.contact).toBeUndefined(); expect(first.state.y).toBeLessThan(250); expect(first.state.vy).toBeLessThan(0);
    const landed = stepCompanionThrow(first.state, 1200, [ledge], bounds);
    expect(landed.contact?.platformId).toBe("upper"); expect(landed.state.elapsedMs).toBeGreaterThan(1000);
    expect(landed.state.y).toBe(250);
  });
  it("does not land on an upper ledge it cannot reach", () => {
    const result = stepCompanionThrow(start(200, 400, 0, -200), 1200, [span("unreachable", 50, 200, 900), span("floor", 50, 700, 900, "floor")], bounds);
    expect(result.contact?.platformId).toBe("floor");
  });
  it("chooses earliest real contact independently of candidate order and resolves equal tops deterministically", () => {
    const a = span("a", 50, 500, 900), b = span("b", 50, 500, 900), floor = span("floor", 50, 500, 900, "floor");
    for (const candidates of [[floor, b, a], [a, b, floor], [b, floor, a]]) expect(stepCompanionThrow(start(), 1500, candidates, bounds).contact?.platformId).toBe("a");
  });
  it("keeps gaps empty and never remaps to a remote same-height span", () => {
    const candidates = [span("left", 50, 500, 100), span("right", 400, 500, 100), span("real-floor", 50, 800, 900, "floor")];
    const result = stepCompanionThrow(start(250, 300), 1500, candidates, bounds);
    expect(result.contact).toEqual({ x: 250, y: 800, platformId: "real-floor" });
  });
  it("uses the currently provided supports, so a removed target cannot catch a later frame", () => {
    const removed = span("removed", 50, 500, 900), floor = span("floor", 50, 800, 900, "floor");
    const next = stepCompanionThrow(start(), 100, [removed, floor], bounds);
    expect(next.contact).toBeUndefined();
    expect(stepCompanionThrow(next.state, 1500, [floor], bounds).contact?.platformId).toBe("floor");
  });
  it("stops horizontal velocity at the exact wall while consuming the remaining vertical flight", () => {
    const result = stepCompanionThrow(start(900, 300, 500), 500, [], bounds);
    expect(result.state).toMatchObject({ x: 950, y: 437.5, vx: 0, vy: 550, elapsedMs: 500, done: false });
    expect(stepCompanionThrow(start(900, 300, 500), 100, [], bounds).state.vx).toBe(0);
  });
  it("checks supports after a wall changes the remainder's horizontal path", () => {
    // Without the wall, x at y500 would be1001.51, outside this ledge.
    const result = stepCompanionThrow(start(700, 300, 500), 1500, [span("edge", 949, 500, 1)], bounds);
    expect(result.contact).toEqual({ x: 950, y: 500, platformId: "edge" });
  });
  it("hits the ceiling continuously, loses upward velocity, and falls for the rest of the frame", () => {
    const state = start(200, 150, 100, -500), hit = (500 - Math.sqrt(140000)) / 1100;
    const result = stepCompanionThrow(state, 500, [], bounds);
    expect(result.state.x).toBeCloseTo(250, 9); expect(result.state.y).toBeCloseTo(100 + 550 * (.5 - hit) ** 2, 8);
    expect(result.state.vy).toBeCloseTo(1100 * (.5 - hit), 8); expect(result.state.done).toBe(false);
  });
  it("handles a simultaneous wall/ceiling event without spending or losing time twice", () => {
    const x = 900, y = 144.5; // Both boundaries are reached at100ms.
    const whole = stepCompanionThrow(start(x, y, 500, -500), 500, [], bounds).state;
    const first = stepCompanionThrow(start(x, y, 500, -500), 100, [], bounds).state;
    expect(first).toMatchObject({ x: 950, y: 100, vx: 0, vy: 0, done: false, expired: false });
    const split = stepCompanionThrow(first, 400, [], bounds).state;
    expect(whole.x).toBe(950); expect(whole.y).toBeCloseTo(188, 8); expect(whole.elapsedMs).toBeCloseTo(500, 8);
    expect(split.y).toBeCloseTo(whole.y, 8); expect(split.vy).toBeCloseTo(whole.vy, 8);
  });
  it("expires at a simultaneous wall/bottom exactly at the end of a frame, but a real floor still wins", () => {
    const state = start(900, 888.5, 500, 60);
    const missed = stepCompanionThrow(state, 100, [], bounds);
    expect(missed.contact).toBeUndefined(); expect(missed.state).toMatchObject({ x: 950, y: 900, vx: 0, vy: 0, done: true, expired: true });
    expect(missed.state.elapsedMs).toBeCloseTo(100, 8);
    const floor = stepCompanionThrow(state, 100, [span("edge-floor", 949, 900, 1, "floor")], bounds);
    expect(floor.contact).toEqual({ x: 950, y: 900, platformId: "edge-floor" }); expect(floor.state.expired).toBe(false);
  });
  it("lets a zero-velocity drop hit the exact current support once", () => {
    const platform = span("occupied", 50, 300, 900);
    const result = stepCompanionThrow(start(), 16, [platform], bounds);
    expect(result.contact).toEqual({ x: 200, y: 300, platformId: "occupied" }); expect(result.state.elapsedMs).toBe(0);
    expect(stepCompanionThrow(result.state, 16, [platform], bounds).contact).toBeUndefined();
  });
  it("expires at the viewport bottom without inventing a landing", () => {
    const result = stepCompanionThrow(start(), 1000000000, [], bounds);
    expect(result.contact).toBeUndefined(); expect(result.state).toMatchObject({ x: 200, y: 900, done: true, expired: true, vx: 0, vy: 0 });
    expect(result.state.elapsedMs).toBeCloseTo(Math.sqrt(1200 / 1100) * 1000, 8);
  });
  it("keeps an actual floor contact at the bottom instead of expiring at the equal boundary", () => {
    expect(stepCompanionThrow(start(), 2000, [span("real-floor", 50, 900, 900, "floor")], bounds).contact?.platformId).toBe("real-floor");
  });
  it("has a hard three-second bound even when the world has no nearby bottom", () => {
    const huge = { ...bounds, bottom: 100000 };
    const result = stepCompanionThrow(start(200, 300, 50, 0, huge), Number.MAX_VALUE, [], huge);
    expect(result.contact).toBeUndefined(); expect(result.state).toMatchObject({ x: 350, y: 5250, elapsedMs: 3000, done: true, expired: true });
    expect(finite(result.state)).toBe(true);
  });
  it("rejects invalid starts, bounds and impulses without clamping or teleporting a release", () => {
    for (const p of [{ x: NaN, y: 300 }, { x: 200, y: Infinity }, { x: 49, y: 300 }, { x: 200, y: 99 }]) expect(createCompanionThrow(p, { vx: 0, vy: 0 }, bounds)).toBeUndefined();
    expect(createCompanionThrow({ x: 200, y: 300 }, { vx: NaN, vy: 0 }, bounds)).toBeUndefined();
    expect(createCompanionThrow({ x: 200, y: 300 }, { vx: 0, vy: 0 }, { ...bounds, right: 50 })).toBeUndefined();
    expect(start(200, 300, 10000, -10000)).toMatchObject({ vx: 1100, vy: -950 });
  });
  it("fails closed on corrupt state/changed bounds while invalid elapsed time adds no motion", () => {
    const state = start();
    for (const dt of [NaN, Infinity, -1]) expect(stepCompanionThrow(state, dt, [], bounds)).toEqual({ state });
    for (const invalid of [{ ...state, x: NaN }, { ...state, vy: Infinity }, { ...state, elapsedMs: -1 }]) {
      const result = stepCompanionThrow(invalid, 16, [], bounds);
      expect(result.contact).toBeUndefined(); expect(result.state.done && result.state.expired && finite(result.state)).toBe(true);
    }
    const shrink = stepCompanionThrow(state, 16, [], { ...bounds, left: 250 });
    expect(shrink.state.x).toBe(200); expect(shrink.state.expired).toBe(true); expect(shrink.contact).toBeUndefined();
  });
  it("skips malformed supports and never mutates frozen caller records", () => {
    const state = Object.freeze(start()), floor = Object.freeze(span("floor", 50, 700, 900, "floor"));
    const platforms = Object.freeze([span("", 50, 400, 900), span("negative", 50, 400, -1), span("nan", NaN, 400, 900), span("overflow", Number.MAX_VALUE, 400, Number.MAX_VALUE), floor]);
    expect(stepCompanionThrow(state, 1500, platforms, bounds).contact?.platformId).toBe("floor");
    expect(state).toEqual(start()); expect(platforms.at(-1)).toBe(floor); expect(floor).toEqual(span("floor", 50, 700, 900, "floor"));
  });
  it("rejects input beyond the geometry resource bound instead of depending on array order", () => {
    const platforms = Array.from({ length: COMPANION_THROW_LIMITS.maxPlatforms + 1 }, (_, i) => span(`p${i}`, 50, 700, 900));
    const result = stepCompanionThrow(start(), 100, platforms, bounds);
    expect(result.state.expired).toBe(true); expect(result.contact).toBeUndefined();
  });
});
