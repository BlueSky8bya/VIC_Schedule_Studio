import { describe, expect, it } from "vitest";
import {
  advanceBrain, commitAction, createBrain, getAction, nearestPlatform,
  platformLandingX, reachablePlatforms, recordCompanionEvent,
  type CompanionBehaviorPreferences, type CompanionBrain, type CompanionWorld, type Platform,
} from "@/lib/ui/viewer-companion/brain";

const prefs: CompanionBehaviorPreferences = {
  enabled: true, roam: true, jump: true, sleep: true, heartPrank: true,
  ambientPrank: true, drag: true, petting: true,
  speed: "normal", size: "normal", personality: "curious",
};
const floor: Platform = { id: "floor", x: 0, y: 700, width: 1000, kind: "floor" };
const card: Platform = { id: "card", x: 300, y: 580, width: 170, kind: "card", heart: { x: 450, y: 595 } };
const world: CompanionWorld = { x: 400, y: 580, platformId: "card", platforms: [floor, card], width: 1000, height: 800, ambientAvailable: true };
function seeded(seed = 123) {
  let value = seed;
  return () => { value = Math.imul(value, 1664525) + 1013904223 | 0; return (value >>> 0) / 4294967296; };
}
function decisions(options: Partial<CompanionBehaviorPreferences> = {}, context = world) {
  const brain = { ...createBrain(0, () => .5), energy: .3 };
  const rng = seeded();
  return Array.from({ length: 2000 }, () => getAction(brain, context, { ...prefs, ...options }, 100000, rng));
}

describe("viewer companion's local platform brain", () => {
  it("keeps foot landings inside narrow and ordinary supports", () => {
    expect(platformLandingX(card, -200)).toBe(312);
    expect(platformLandingX(card, 2000)).toBe(458);
    expect(platformLandingX({ ...card, width: 10 }, 500)).toBe(305);
  });

  it("finds the nearest top surface and ignores invalid geometry", () => {
    expect(nearestPlatform({ x: 420, y: 582 }, [floor, card])?.id).toBe("card");
    expect(nearestPlatform({ x: NaN, y: 10 }, [floor])).toBeUndefined();
    expect(nearestPlatform({ x: 10, y: 10 }, [{ ...floor, width: -1 }])).toBeUndefined();
  });

  it("caps jump rise, drop and distance and uses an actual ballistic arc", () => {
    const ledge = (id: string, x: number, y: number): Platform => ({ id, x, y, width: 24, kind: "card" });
    const targets = [
      ledge("near", 140, 400), ledge("apex-near", 100, 260),
      ledge("apex-too-far", 150, 260), ledge("too-high", 0, 259),
      ledge("too-low", 0, 641), ledge("too-far", 261, 400),
      ledge("drop", 210, 640),
    ];
    expect(reachablePlatforms({ x: 12, y: 400 }, targets).map(p => p.id)).toEqual(["near", "apex-near", "drop"]);
    expect(reachablePlatforms({ x: Infinity, y: 0 }, targets)).toEqual([]);
    expect(reachablePlatforms({ x: 0, y: 0 }, targets, { gravity: 0 })).toEqual([]);
  });

  it("replays deterministically without changing the supplied state", () => {
    const a = createBrain(0, seeded(7));
    const before = JSON.stringify(a);
    const r1 = seeded(9), r2 = seeded(9);
    expect(Array.from({ length: 30 }, () => getAction(a, world, prefs, 100000, r1)))
      .toEqual(Array.from({ length: 30 }, () => getAction(a, world, prefs, 100000, r2)));
    expect(JSON.stringify(a)).toBe(before);
  });

  it("disabled or paused companions never propose navigation or a prank", () => {
    expect(new Set(decisions({ enabled: false }).map(a => a.kind))).toEqual(new Set(["idle"]));
    expect(new Set(decisions({}, { ...world, paused: true }).map(a => a.kind))).toEqual(new Set(["idle"]));
  });

  it("roam off permits only stationary poses and sleep", () => {
    const actions = decisions({ roam: false });
    expect(new Set(actions.map(a => a.kind))).toEqual(new Set(["idle", "look", "sleep"]));
    expect(actions.every(a => a.target.x === world.x && a.target.y === world.y)).toBe(true);
  });

  it("jump off keeps all actions on the occupied support", () => {
    const actions = decisions({ jump: false });
    expect(actions.some(a => a.kind === "walk")).toBe(true);
    expect(actions.some(a => a.kind === "heart")).toBe(true);
    expect(actions.some(a => a.kind === "jump")).toBe(false);
    expect(actions.every(a => a.target.platformId === "card" && a.target.y === card.y)).toBe(true);
  });

  it("lands at the reachable edge rather than a distant wide platform centre", () => {
    const origin: Platform = { id: "origin", x: 0, y: 400, width: 80, kind: "card" };
    const broad: Platform = { id: "broad", x: 140, y: 450, width: 850, kind: "card" };
    const context = { ...world, x: 40, y: 400, platformId: "origin", platforms: [origin, broad] };
    const jumps = decisions({}, context).filter(action => action.kind === "jump");
    expect(jumps.length).toBeGreaterThan(0);
    expect(jumps.every(action => action.target.x === 152 && action.target.y === 450)).toBe(true);
  });

  it("crossed preferences suppress each optional action independently", () => {
    const actions = decisions({ jump: false, sleep: false, heartPrank: false, ambientPrank: false });
    expect(new Set(actions.map(a => a.kind))).toEqual(new Set(["idle", "look", "walk"]));
    expect(decisions({ heartPrank: false }).some(a => a.kind === "heart")).toBe(false);
  });

  it("uses separate visual heart coordinates and never proposes a remote heart", () => {
    const heart = decisions().find(a => a.kind === "heart")!;
    expect(heart.effectPoint).toEqual(card.heart);
    expect(heart.target.y).toBe(card.y);
    expect(decisions({}, { ...world, platformId: "floor", y: 700 }).some(a => a.kind === "heart")).toBe(false);
  });

  it("commits rare-action cooldowns once and blocks repeated pranks", () => {
    const brain = createBrain(0, () => .5);
    const heart = decisions().find(a => a.kind === "heart")!;
    const next = commitAction(brain, heart, 100000);
    expect(brain.recent).toEqual([]);
    expect(next.recent).toEqual(["heart"]);
    expect(next.cooldowns.heart).toBe(147200);
    expect(Array.from({ length: 300 }, () => getAction(next, world, prefs, 100001, seeded())).some(a => a.kind === "heart")).toBe(false);
  });

  it("hides rarely, only with a suitable floor and available ambient", () => {
    const context = { ...world, x: 120, y: 700, platformId: "floor" };
    const actions = decisions({}, context);
    const hides = actions.filter(a => a.kind === "hide");
    expect(hides.length).toBeGreaterThan(0);
    expect(hides.length).toBeLessThan(100);
    expect(hides.every(a => a.target.y === floor.y)).toBe(true);
    expect(decisions({}, { ...context, ambientAvailable: false }).some(a => a.kind === "hide")).toBe(false);
    expect(decisions({ ambientPrank: false }, context).some(a => a.kind === "hide")).toBe(false);
    const brain = createBrain();
    expect(Array.from({ length: 200 }, () => getAction(brain, context, prefs, 44000, seeded())).some(a => a.kind === "hide")).toBe(false);
  });

  it("clamps needs, rewards affection and ignores hidden-tab catch-up time", () => {
    const brain = createBrain(0, () => .5);
    const loved = Array.from({ length: 30 }).reduce<CompanionBrain>(state => recordCompanionEvent(state, "petted"), brain);
    expect(loved.affection).toBe(1);
    expect(loved.energy).toBeLessThanOrEqual(1);
    expect(recordCompanionEvent(brain, "rested").energy).toBeGreaterThan(brain.energy);
    expect(advanceBrain(brain, 3600000)).toEqual(advanceBrain(brain, 30000));
    expect(advanceBrain(brain, -100)).toEqual(brain);
  });
});
