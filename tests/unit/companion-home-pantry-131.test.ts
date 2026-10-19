import { describe, expect, it } from "vitest";
import { createBrain, type CompanionFood, type Platform } from "@/lib/ui/viewer-companion/brain";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_LIFE } from "@/lib/ui/viewer-companion/life";
import { createCompanionScenes, type CompanionSceneAction, type CompanionSceneInput } from "@/lib/ui/viewer-companion/scenes";
import { newCompanionSceneMemory } from "@/lib/ui/viewer-companion/scene-memory";
import { selectCompanionHomePantryPoint } from "@/lib/ui/viewer-companion/home-pantry";

const calendar: Platform = { id: "calendar", kind: "floor", x: 0, y: 600, width: 250 };
const room: Platform = { id: "companion-home-floor", kind: "floor", manualOnly: true, x: 300, y: 600, width: 280 };
const food: CompanionFood = { id: "outside-food", kind: "apple", x: 150, y: 600, platformId: calendar.id };
const pantry = { x: 430, y: room.y, platformId: room.id };
function scenario(id: 13 | 16 | 17 | 19 = 13) {
  const controller = createCompanionScenes(newCompanionSceneMemory());
  const input: CompanionSceneInput = { brain: { ...createBrain(0, () => 0), hunger: .1, energy: .95, life: { ...DEFAULT_COMPANION_LIFE, favoriteFood: "durian" } },
    world: { x: 150, y: 600, platformId: calendar.id, platforms: [calendar, room], foods: [food], animated: true, width: 1000, height: 700 },
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "tidy" }, pantry, now: 10000, knownFoods: ["apple"], owned: [], equipped: null };
  if (id === 16) { input.radio = { playing: true, mood: "calm" }; controller.event({ kind: "radio", mood: "calm" }, input.now); }
  if (id === 17) { input.world.pointer = { x: 150, y: 550, stableMs: 1000 }; controller.event({ kind: "household", effect: "spawn", foodId: food.id }, input.now); }
  if (id === 19) {
    controller.event({ kind: "cleanup-interrupted", foodId: food.id, point: { x: 70, y: calendar.y, platformId: calendar.id }, discard: true }, input.now);
    controller.event({ kind: "meal", food: "bread", first: false, favoriteChanged: false }, input.now);
  }
  const complete = (action: CompanionSceneAction) => {
    input.now += action.duration;
    if (["walk", "jump"].includes(action.kind)) input.world = { ...input.world, ...action.target };
    if (action.scene.effect?.kind === "pick") { input.carriedFoodId = food.id; input.world.foods = []; controller.resolve(action, true); }
    else if (action.scene.effect) { input.carriedFoodId = undefined; input.world.foods = action.scene.effect.kind === "put" ? [{ ...food, ...action.scene.effect.point }] : []; controller.resolve(action, true); }
    controller.complete(action);
  };
  return { controller, input, complete };
}
function drain(s: ReturnType<typeof scenario>) {
  const actions: CompanionSceneAction[] = [];
  let id: number | undefined;
  for (let i = 0; i < 30; i++) { const action = s.controller.next(s.input); if (!action || id !== undefined && action.scene.id !== id) break; id ??= action.scene.id; actions.push(action); s.complete(action); }
  return actions;
}

describe("shared actual pantry policy for ordinary cleanup and authored scenes", () => {
  for (const id of [13, 16, 17] as const) it(`scene${id} carries an outdoor food into the actual house instead of a44px calendar rearrangement`, () => {
    const s = scenario(id), actions = drain(s), effects = actions.filter(action => action.scene.effect);
    expect(effects.map(action => action.scene.effect!.kind)).toEqual(["pick", "put"]);
    expect(actions.some(action => action.kind === "jump" && action.target.platformId === room.id)).toBe(true);
    const put = effects[1]; expect(put.scene.effect!.point.platformId).toBe(room.id); expect(put.target.platformId).toBe(room.id);
    expect(put.scene.effect!.point.x).toBeGreaterThanOrEqual(room.x + 12);
    expect(put.scene.effect!.point.x).toBeLessThanOrEqual(room.x + room.width - 12);
  });
  it("never picks without an actual connected home pantry route", () => {
    for (const change of ["missing", "wrong-support", "disconnected"] as const) {
      const s = scenario();
      if (change === "missing") s.input.pantry = undefined;
      if (change === "wrong-support") s.input.pantry = { x: 180, y: calendar.y, platformId: calendar.id };
      if (change === "disconnected") { s.input.world.platforms = [calendar, { ...room, x: 1500 }]; s.input.pantry = { ...pantry, x: 1600 }; }
      expect(drain(s).some(action => action.scene.effect?.kind === "pick")).toBe(false);
      expect(s.input.world.foods).toEqual([food]); expect(s.input.carriedFoodId).toBeUndefined();
    }
  });
  it("preserves actual unreachable neighbours and refuses a completely occupied pantry", () => {
    const near = { ...food, id: "unreachable-room-food", x: pantry.x, platformId: "not-routeable" };
    const target = selectCompanionHomePantryPoint({ pantry, platforms: [calendar, room], visibleFoods: [food, near], allowJump: true }, { ...food, platformId: calendar.id }, food)!;
    expect(Math.hypot(target.x - near.x, target.y - near.y)).toBeGreaterThanOrEqual(44);
    const occupied = [318, 362, 406, 450, 494, 538, 580].map((x, i) => ({ ...near, id: `occupied-${i}`, x }));
    const s = scenario(); s.input.visibleFoods = [food, ...occupied];
    expect(drain(s).some(action => action.scene.effect?.kind === "pick")).toBe(false);
    expect(s.input.world.foods).toEqual([food]);
  });
  it("replans the same carried identity when the former pantry landing gains a neighbour", () => {
    const s = scenario(); const pick = s.controller.next(s.input)!; s.complete(pick);
    let action = s.controller.next(s.input)!;
    while (action.kind !== "jump") { s.complete(action); action = s.controller.next(s.input)!; }
    const oldLanding = { ...action.target }; s.complete(action);
    const neighbour = { ...food, id: "new-neighbour", ...oldLanding };
    s.input.visibleFoods = [neighbour];
    const replanned = s.controller.next(s.input)!;
    expect(replanned).toMatchObject({ kind: "walk", scene: { id: 13, beat: 2 } });
    expect(replanned.target.platformId).toBe(room.id);
    expect(Math.hypot(replanned.target.x - neighbour.x, replanned.target.y - neighbour.y)).toBeGreaterThanOrEqual(44);
    s.complete(replanned); const put = s.controller.next(s.input)!;
    expect(put.scene.effect).toMatchObject({ kind: "put", foodId: food.id, point: replanned.target });
  });
  it("cancels a lost real floor after pickup without creating a put/discard acknowledgement", () => {
    const s = scenario(); s.complete(s.controller.next(s.input)!);
    s.input.world.platforms = [calendar];
    expect(s.controller.next(s.input)).toBeUndefined(); expect(s.input.carriedFoodId).toBe(food.id);
    expect(s.controller.hasReservedFood()).toBeUndefined();
  });
  it("scene19 uses the current real bin only while full, falling back to the actual pantry after hunger changes", () => {
    const full = scenario(19); full.input.bin = { x: 540, y: room.y, platformId: room.id };
    const fullEffects = drain(full).flatMap(action => action.scene.effect ? [action.scene.effect] : []);
    expect(fullEffects.map(effect => effect.kind)).toEqual(["pick", "discard"]);
    expect(fullEffects[1].point).toEqual(full.input.bin);
    const changed = scenario(19); changed.input.bin = full.input.bin; changed.complete(changed.controller.next(changed.input)!);
    changed.input.brain.hunger = .5;
    const changedEffects = drain(changed).flatMap(action => action.scene.effect ? [action.scene.effect] : []);
    expect(changedEffects.map(effect => effect.kind)).toEqual(["put"]);
    expect(changedEffects[0].point.platformId).toBe(room.id);
    const absent = scenario(19); absent.input.pantry = undefined; absent.input.bin = { x: 70, y: calendar.y, platformId: calendar.id };
    expect(drain(absent).some(action => action.scene.effect?.kind === "pick")).toBe(false);
  });
});
