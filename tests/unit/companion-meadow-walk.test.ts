import { describe, expect, it } from "vitest";
import { createCompanionMeadowWalk } from "@/lib/ui/viewer-companion/meadow-walk";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const viewport = { width: 1440, height: 960 };
function random(seed = 19) { let n = seed; return () => { n = n * 1664525 + 1013904223 >>> 0; return n / 4294967296; }; }

describe("the temporary companion meadow walk", () => {
  it("departs from an actual outdoor foot and rebases a user drag without snapping to the old walk", () => {
    const controller = createCompanionMeadowWalk(random());
    controller.place({ x: 90, y: 900 }, viewport);
    const first = controller.sample(0, viewport, DEFAULT_COMPANION_PREFERENCES, false)!;
    expect(first.x).toBeCloseTo(90, 8); expect(first.groundY).toBeCloseTo(900, 8);
    for (let i = 0; i < 30; i++) controller.sample(50, viewport, DEFAULT_COMPANION_PREFERENCES);
    controller.place({ x: 750, y: 650 }, viewport);
    const dragged = controller.sample(0, viewport, DEFAULT_COMPANION_PREFERENCES, false)!;
    expect(dragged.x).toBeCloseTo(750, 8); expect(dragged.groundY).toBeCloseTo(650, 8);
    const resumed = controller.sample(50, viewport, DEFAULT_COMPANION_PREFERENCES)!;
    expect(Math.hypot(resumed.x - dragged.x, resumed.groundY - dragged.groundY)).toBeLessThan(1);
  });
  it.each(COMPANION_PERSONALITIES)("keeps %s on grass with short pauses and continuous varied travel", personality => {
    const controller = createCompanionMeadowWalk(random());
    const prefs = { ...DEFAULT_COMPANION_PREFERENCES, personality };
    let previous = controller.sample(0, viewport, prefs)!, stoppedFor = 0, longestStop = 0;
    const legs = new Set<number>(), rows = new Set<number>();
    for (let elapsed = 0; elapsed < 90000; elapsed += 50) {
      const now = controller.sample(50, viewport, prefs)!;
      expect(now.x - 46).toBeGreaterThan(0); expect(now.x + 46).toBeLessThan(viewport.width);
      expect(now.y - 92).toBeGreaterThan(viewport.height * .35);
      expect(now.groundY).toBeLessThan(viewport.height - 80);
      expect(Math.hypot(now.x - previous.x, now.y - previous.y)).toBeLessThan(42);
      stoppedFor = now.status === "look" ? stoppedFor + 50 : 0;
      longestStop = Math.max(longestStop, stoppedFor); legs.add(now.leg); rows.add(now.row); previous = now;
    }
    expect(longestStop).toBeLessThan(2600); expect(legs.size).toBeGreaterThan(15);
    expect(rows.has(2)).toBe(true); expect(rows.has(20)).toBe(true);
    expect(rows.has(4)).toBe(true); expect(rows.has(6)).toBe(true);
  });

  it("freezes the same destination and foot while hidden or in reduced motion", () => {
    const controller = createCompanionMeadowWalk(random());
    let before = controller.sample(0, viewport, DEFAULT_COMPANION_PREFERENCES)!;
    for (let i = 0; i < 40; i++) before = controller.sample(50, viewport, DEFAULT_COMPANION_PREFERENCES)!;
    const paused = controller.sample(60000, viewport, DEFAULT_COMPANION_PREFERENCES, false)!;
    expect(paused.x).toBe(before.x); expect(paused.groundY).toBe(before.groundY); expect(paused.leg).toBe(before.leg);
    const resumed = controller.sample(0, viewport, DEFAULT_COMPANION_PREFERENCES)!;
    expect(resumed.x).toBe(before.x); expect(resumed.y).toBe(before.y); expect(resumed.leg).toBe(before.leg);
  });

  it("honors roam OFF and jump OFF independently without changing preferences", () => {
    const controller = createCompanionMeadowWalk(random());
    const off = { ...DEFAULT_COMPANION_PREFERENCES, roam: false };
    const before = JSON.stringify(off), first = controller.sample(0, viewport, off)!;
    for (let i = 0; i < 1200; i++) {
      const sample = controller.sample(50, viewport, off)!;
      expect(sample.x).toBe(first.x); expect(sample.y).toBe(first.y); expect(sample.status).toBe("idle");
    }
    expect(JSON.stringify(off)).toBe(before);
    const withoutJump = { ...DEFAULT_COMPANION_PREFERENCES, jump: false };
    for (let i = 0; i < 1800; i++) expect(controller.sample(50, viewport, withoutJump)!.status).not.toBe("jump");
  });

  it("keeps a live leg within the new viewport after resize and rejects invalid bounds", () => {
    const controller = createCompanionMeadowWalk(random());
    for (let i = 0; i < 45; i++) controller.sample(50, viewport, DEFAULT_COMPANION_PREFERENCES);
    const resized = controller.sample(0, { width: 1040, height: 700 }, DEFAULT_COMPANION_PREFERENCES)!;
    expect(resized.x).toBeGreaterThan(100); expect(resized.x).toBeLessThan(950);
    expect(resized.y).toBeGreaterThan(350); expect(resized.groundY).toBeLessThan(620);
    expect(controller.sample(16, { width: NaN, height: 700 }, DEFAULT_COMPANION_PREFERENCES)).toBeNull();
  });

  it("resumes the same partially walked leg after roam OFF -> ON and live personality changes", () => {
    const controller = createCompanionMeadowWalk(random());
    let walking = controller.sample(0, viewport, DEFAULT_COMPANION_PREFERENCES)!;
    for (let i = 0; i < 500 && (walking.row !== 2 || walking.phase < .25); i++) walking = controller.sample(50, viewport, DEFAULT_COMPANION_PREFERENCES)!;
    expect(walking.row).toBe(2); expect(walking.phase).toBeGreaterThan(.25);
    const off = { ...DEFAULT_COMPANION_PREFERENCES, roam: false };
    for (let i = 0; i < 100; i++) {
      const paused = controller.sample(50, viewport, off)!;
      expect(paused.x).toBe(walking.x); expect(paused.y).toBe(walking.y);
      expect(paused.leg).toBe(walking.leg); expect(paused.status).toBe("idle");
    }
    const changed = { ...DEFAULT_COMPANION_PREFERENCES, personality: "tidy" as const, speed: "relaxed" as const, activeWhileVisible: false };
    const resumed = controller.sample(0, viewport, changed)!;
    expect(resumed.x).toBe(walking.x); expect(resumed.y).toBe(walking.y); expect(resumed.leg).toBe(walking.leg);
    const next = controller.sample(50, viewport, changed)!;
    expect(next.leg).toBe(walking.leg); expect(Math.abs(next.x - walking.x)).toBeGreaterThan(.1);
    expect(Math.abs(next.x - walking.x)).toBeLessThan(35);
  });

  it("finishes an already airborne hop at its original destination before holding roam OFF", () => {
    const controller = createCompanionMeadowWalk(random()), baseline = createCompanionMeadowWalk(random());
    let airborne = controller.sample(0, viewport, DEFAULT_COMPANION_PREFERENCES)!;
    baseline.sample(0, viewport, DEFAULT_COMPANION_PREFERENCES);
    for (let i = 0; i < 1800 && airborne.row !== 4; i++) {
      airborne = controller.sample(50, viewport, DEFAULT_COMPANION_PREFERENCES)!;
      baseline.sample(50, viewport, DEFAULT_COMPANION_PREFERENCES);
    }
    expect(airborne.row).toBe(4); expect(controller.settling()).toBe(true);
    const off = { ...DEFAULT_COMPANION_PREFERENCES, roam: false, jump: false };
    const first = controller.sample(0, viewport, off)!;
    expect(first.x).toBe(airborne.x); expect(first.y).toBe(airborne.y);
    let landed = first, expected = airborne;
    for (let i = 0; i < 50 && controller.settling(); i++) landed = controller.sample(50, viewport, off)!;
    for (let i = 0; i < 50 && expected.status === "jump"; i++) expected = baseline.sample(50, viewport, DEFAULT_COMPANION_PREFERENCES)!;
    expect(landed.x).toBeCloseTo(expected.x, 7); expect(landed.y).toBeCloseTo(expected.y, 7);
    expect(landed.status).toBe("idle"); expect(landed.row).toBe(0); expect(controller.settling()).toBe(false);
    const later = controller.sample(50000, viewport, off)!;
    expect(later.x).toBe(landed.x); expect(later.y).toBe(landed.y); expect(later.leg).toBe(airborne.leg);
  });

  it("does not launch a hop disabled during anticipation, and keeps its existing destination", () => {
    const controller = createCompanionMeadowWalk(random());
    let anticipation = controller.sample(0, viewport, DEFAULT_COMPANION_PREFERENCES)!;
    for (let i = 0; i < 1800 && anticipation.row !== 3; i++) anticipation = controller.sample(50, viewport, DEFAULT_COMPANION_PREFERENCES)!;
    expect(anticipation.row).toBe(3);
    const changed = { ...DEFAULT_COMPANION_PREFERENCES, jump: false };
    const samePoint = controller.sample(0, viewport, changed)!;
    expect(samePoint.x).toBe(anticipation.x); expect(samePoint.groundY).toBe(anticipation.groundY);
    expect(samePoint.leg).toBe(anticipation.leg); expect(samePoint.status).toBe("walk");
    for (let i = 0; i < 1800; i++) expect(controller.sample(50, viewport, changed)!.status).not.toBe("jump");
  });
});


describe("direct seasonal departure", () => {
  it("jumps from the actual home foot immediately even with autonomous roam and jump disabled", () => {
    const walker = createCompanionMeadowWalk(() => .5), view = { width: 1440, height: 1000 };
    const prefs = { ...DEFAULT_COMPANION_PREFERENCES, roam: false, jump: false };
    walker.enter({ x: 160, y: 500 }, view);
    const start = walker.sample(0, view, prefs)!;
    expect(start).toMatchObject({ x: 160, y: 500, status: "jump", row: 3 });
    const frames = Array.from({ length: 14 }, () => walker.sample(50, view, prefs)!);
    expect(frames.some(frame => frame.groundY - frame.y > 100)).toBe(true);
    expect(frames.at(-1)).toMatchObject({ status: "idle", row: 0 });
    expect(frames.every(frame => Math.abs(frame.x - 160) < .00001)).toBe(true);
    expect(frames.at(-1)!.groundY).toBeCloseTo(500);
    expect(walker.settling()).toBe(false);
    expect(walker.sample(50, view, prefs)!.x).toBe(frames.at(-1)!.x);
  });
  it.each([{ x: 90, y: 950, ground: 950 }, { x: 1330, y: 500, ground: 500 }, { x: 750, y: 100, ground: 374 }])("lands directly beneath the original foot at $x/$y", ({ x, y, ground }) => {
    const walker = createCompanionMeadowWalk(() => .5), view = { width: 1440, height: 1000 };
    walker.enter({ x, y }, view);
    const prefs = { ...DEFAULT_COMPANION_PREFERENCES, roam: false, jump: false };
    for (let index = 0; index < 14; index++) {
      const frame = walker.sample(50, view, prefs)!;
      expect(frame.x).toBeCloseTo(x); expect(frame.groundY).toBeGreaterThanOrEqual(y - .00001);
    }
    const landed = walker.sample(0, view, prefs)!;
    expect(landed.x).toBeCloseTo(x); expect(landed.y).toBeCloseTo(ground);
    expect(landed.status).toBe("idle");
  });
  it("lands immediately without an arc for reduced motion and lets direct placement cancel entry", () => {
    const walker = createCompanionMeadowWalk(() => .5), view = { width: 1440, height: 1000 };
    walker.enter({ x: 160, y: 500 }, view);
    const quiet = walker.sample(0, view, DEFAULT_COMPANION_PREFERENCES, false)!;
    expect(quiet.status).toBe("idle"); expect(quiet.x).toBeCloseTo(160); expect(quiet.y).toBeCloseTo(500); expect(walker.settling()).toBe(false);
    walker.enter({ x: 160, y: 500 }, view); walker.place({ x: 250, y: 800 }, view);
    expect(walker.sample(0, view, DEFAULT_COMPANION_PREFERENCES)!).toMatchObject({ x: 250, y: 800 });
  });
});
