import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_TIMING } from "@/lib/ui/viewer-companion/timing";
import {
  advanceBrain, commitAction, createBrain, getAction, nearestPlatform,
  platformLandingX, reachablePlatforms, recordCompanionEvent,
  type CompanionBehaviorPreferences, type CompanionBrain, type CompanionWorld, type Platform,
} from "@/lib/ui/viewer-companion/brain";

const prefs: CompanionBehaviorPreferences = {
  ...DEFAULT_COMPANION_PREFERENCES,
  enabled: true, roam: true, jump: true, sleep: true, heartPrank: true,
  ambientPrank: true, drag: true, petting: true,
  speed: "normal", size: "normal", personality: "curious",
};
const floor: Platform = { id: "floor", x: 0, y: 700, width: 1000, kind: "floor" };
const card: Platform = { id: "card", x: 300, y: 580, width: 170, kind: "card", heart: { x: 450, y: 595 } };
const world: CompanionWorld = { x: 400, y: 580, platformId: "card", platforms: [floor, card], width: 1000, height: 800, hideAvailable: true };
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
    expect(new Set(actions.map(a => a.kind))).toEqual(new Set(["idle", "look", "stretch", "shake", "sleep"]));
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
    const jumps = decisions({}, context).filter(action => action.kind === "jump" && action.target.platformId === broad.id);
    expect(jumps.length).toBeGreaterThan(0);
    for (const action of jumps) {
      expect(action.target.y).toBe(450);
      expect(action.target.x).toBeGreaterThanOrEqual(152);
      expect(action.target.x).toBeLessThanOrEqual(context.x + 260);
      expect(reachablePlatforms(context, [{ ...broad, x: action.target.x - 12, width: 24 }])).toHaveLength(1);
    }
  });

  it("crossed preferences suppress each optional action independently", () => {
    const actions = decisions({ jump: false, sleep: false, heartPrank: false, ambientPrank: false });
    expect(new Set(actions.map(a => a.kind))).toEqual(new Set(["idle", "look", "stretch", "shake", "walk"]));
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
    expect(next.cooldowns.heart).toBe(100000 + COMPANION_TIMING.heart + 45000);
    expect(Array.from({ length: 300 }, () => getAction(next, world, prefs, 100001, seeded())).some(a => a.kind === "heart")).toBe(false);
  });

  it("hides rarely only in a renderer-proven ordinary occupied card", () => {
    const actions = decisions();
    const hides = actions.filter(a => a.kind === "hide");
    expect(hides.length).toBeGreaterThan(0);
    expect(hides.length).toBeLessThan(100);
    expect(hides.every(a => a.duration === 700 && a.target.x === world.x && a.target.y === world.y && a.target.platformId === card.id)).toBe(true);
    expect(decisions({}, { ...world, hideAvailable: false }).some(a => a.kind === "hide")).toBe(false);
    expect(decisions({}, { ...world, hideAvailable: undefined }).some(a => a.kind === "hide")).toBe(false);
    expect(decisions({}, { ...world, x: 120, y: 700, platformId: "floor" }).some(a => a.kind === "hide")).toBe(false);
    const manualHides = decisions({}, { ...world, platforms: [{ ...card, manualOnly: true }] }).filter(a => a.kind === "hide");
    expect(manualHides.length).toBeGreaterThan(0);
    expect(manualHides.every(a => a.target.x === world.x && a.target.y === world.y && a.target.platformId === card.id)).toBe(true);
    expect(decisions({}, { ...world, platforms: [{ ...card, kind: "date" }] }).some(a => a.kind === "hide")).toBe(false);
    expect(decisions({ ambientPrank: false }).some(a => a.kind === "hide")).toBe(false);
    const brain = createBrain(0);
    expect(Array.from({ length: 200 }, () => getAction(brain, world, prefs, 44000, seeded())).some(a => a.kind === "hide")).toBe(false);
  });

  it("commits one finite hide entry and retains the rare-action cooldown", () => {
    const brain = { ...createBrain(0), cooldowns: { idle: Infinity, look: Infinity, stretch: Infinity, shake: Infinity, walk: Infinity } };
    const options = { ...prefs, jump: false, sleep: false, heartPrank: false };
    const hide = getAction(brain, world, options, 100000, () => 0);
    expect(hide).toEqual({ kind: "hide", target: { x: world.x, y: world.y, platformId: card.id }, duration: 700 });
    const next = commitAction(brain, hide, 100000);
    expect(next.cooldowns.hide).toBe(190700);
    expect(getAction(next, world, options, 100701, () => 0).kind).toBe("idle");
    expect(getAction(brain, world, options, 100000, () => .999).kind).toBe("idle");
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

  it("keeps floor excursions short, coherent and reverses at an edge", () => {
    const options = { ...prefs, jump: false, sleep: false, heartPrank: false, ambientPrank: false };
    const context = { ...world, platforms: [floor], platformId: floor.id, x: 400, y: floor.y };
    const healthy = { ...createBrain(), energy: .85 };
    const first = getAction(healthy, context, options, 100000, () => .999999);
    expect(first.kind).toBe("walk"); expect(first.direction).toBe(1);
    expect(first.target.x - context.x).toBeGreaterThan(35);
    expect(first.target.x - context.x).toBeLessThanOrEqual(120);
    const next = commitAction(healthy, first, 100000);
    const second = getAction(next, { ...context, ...first.target }, options, 110000, () => .999999);
    expect(second.kind).toBe("walk"); expect(second.direction).toBe(1);
    const edge = getAction(healthy, { ...context, x: 980 }, options, 100000, () => .999999);
    expect(edge.kind).toBe("walk"); expect(edge.direction).toBe(-1);
    expect(edge.target.x).toBeLessThan(980);
  });

  it("adds small same-support hops only when both navigation preferences allow them", () => {
    const options = { sleep: false, heartPrank: false, ambientPrank: false };
    const hops = decisions(options).filter(action => action.jumpHeight !== undefined);
    expect(hops.length).toBeGreaterThan(0);
    for (const hop of hops) {
      expect(hop.kind).toBe("jump"); expect(hop.target.platformId).toBe(card.id);
      expect(hop.target.y).toBe(world.y);
      expect(hop.jumpHeight).toBeGreaterThanOrEqual(28); expect(hop.jumpHeight).toBeLessThanOrEqual(44);
      expect(Math.abs(hop.target.x - world.x)).toBeGreaterThan(18);
      expect(Math.abs(hop.target.x - world.x)).toBeLessThanOrEqual(52);
      expect(reachablePlatforms(world, [{ ...card, x: hop.target.x - 12, width: 24 }], { maxRise: hop.jumpHeight! })).toHaveLength(1);
    }
    expect(decisions({ ...options, jump: false }).every(action => action.jumpHeight === undefined)).toBe(true);
    expect(decisions({ ...options, roam: false }).every(action => action.jumpHeight === undefined)).toBe(true);
  });

  it("favors exploration when fresh, then short stationary recovery after a movement burst", () => {
    const fresh = { ...createBrain(0, () => .5), energy: .85, curiosity: .8 };
    const recovering: CompanionBrain = { ...fresh, recent: ["walk", "jump", "walk"] };
    const sample = (brain: CompanionBrain) => {
      const rng = seeded(37);
      return Array.from({ length: 2000 }, () => getAction(brain, world, { ...prefs, sleep: false, heartPrank: false, ambientPrank: false }, 100000, rng));
    };
    const moving = (action: ReturnType<typeof getAction>) => action.kind === "walk" || action.kind === "jump";
    const active = sample(fresh), rested = sample(recovering);
    expect(active.filter(moving).length).toBeGreaterThan(1100);
    expect(rested.filter(moving).length).toBeLessThan(350);
    expect(rested.filter(action => !moving(action)).every(action => action.duration <= 1700)).toBe(true);
    expect(new Set(active.map(action => action.kind))).toEqual(new Set(["idle", "look", "stretch", "shake", "walk", "jump"]));
  });

  it("retains energy and curiosity through a short exploration sequence", () => {
    let brain = { ...createBrain(0, () => .5), energy: .8, curiosity: .8 };
    for (let step = 0; step < 20; step++) brain = commitAction(brain, { kind: step % 2 ? "walk" : "jump", target: { x: 400, y: 580, platformId: `public-ledge-${step % 6}` }, duration: 1000 }, step * 1500);
    expect(brain.energy).toBeGreaterThan(.65);
    expect(brain.curiosity).toBeGreaterThan(.5);
    expect(brain.visited).toHaveLength(6);
    expect(brain.recent).toHaveLength(8);
  });

  it("gives stretch and shake independent cooldowns while keeping every pose on its support", () => {
    const options = { ...prefs, roam: false, sleep: false };
    const brain = createBrain(0, () => .5), rng = seeded(5);
    const all = Array.from({ length: 1000 }, () => getAction(brain, world, options, 100000, rng));
    const stretch = all.find(action => action.kind === "stretch")!;
    expect(stretch).toBeTruthy();
    const committed = commitAction(brain, stretch, 100000), later = seeded(7);
    const next = Array.from({ length: 1000 }, () => getAction(committed, world, options, 100000 + stretch.duration + 1, later));
    expect(next.some(action => action.kind === "stretch")).toBe(false);
    expect(next.some(action => action.kind === "shake")).toBe(true);
    expect(next.every(action => action.target.x === world.x && action.target.y === world.y && action.target.platformId === world.platformId)).toBe(true);
  });

  it("keeps cat stalking and dog approach within short, valid steps", () => {
    const context = { ...world, platforms: [floor], platformId: floor.id, x: 400, y: floor.y, pointer: { x: 950, y: floor.y } };
    for (const animalMode of ["cat", "dog"] as const) {
      const walks = decisions({ animalMode, jump: false, sleep: false, heartPrank: false, ambientPrank: false }, context).filter(action => action.kind === "walk");
      expect(walks.length).toBeGreaterThan(0);
      expect(walks.every(action => action.target.x > world.x && action.target.x - context.x <= (animalMode === "cat" ? 100 : 140))).toBe(true);
      if (animalMode === "cat") expect(walks.every(action => action.pace === "amble")).toBe(true);
    }
  });
});
