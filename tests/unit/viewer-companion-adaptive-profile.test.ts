import { describe, expect, it } from "vitest";
import { getCompanionBehaviorProfile } from "@/lib/ui/viewer-companion/behavior-profile";
import { advanceBrain, commitAction, createBrain, getAction, recordCompanionEvent, type CompanionAction, type CompanionBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { deliberateCompanionAction } from "@/lib/ui/viewer-companion/deliberation";
import { advanceCompanionHabits, DEFAULT_COMPANION_HABITS, learnCompanionHabits, type CompanionExperience, type CompanionHabits } from "@/lib/ui/viewer-companion/habits";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";

const prefs = { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, feeding: false, heartPrank: false, ambientPrank: false, panelPrank: false };
const floor: Platform = { id: "floor", x: 0, y: 700, width: 1000, kind: "floor" };
const world: CompanionWorld = { x: 500, y: 700, platformId: floor.id, platforms: [floor], width: 1000, height: 900 };
const healthy = (habits?: CompanionHabits): CompanionBrain => ({ ...createBrain(0, () => .5), energy: .8, curiosity: .8, hunger: .1, habits });
const traits = (habits: CompanionHabits | undefined) => ({ sociability: habits?.sociability, playfulness: habits?.playfulness, confidence: habits?.confidence });
const trained = (experience: CompanionExperience, count = 50): CompanionHabits => {
  let habits = { ...DEFAULT_COMPANION_HABITS };
  for (let index = 0; index < count; index++) habits = learnCompanionHabits(advanceCompanionHabits(habits, 18000), experience);
  return habits;
};
function seeded(seed = 121) { let value = seed; return () => { value = Math.imul(value, 1664525) + 1013904223 | 0; return (value >>> 0) / 4294967296; }; }
function actions(habits: CompanionHabits | undefined, preferences = prefs, context = world, count = 96) {
  const rng = seeded();
  return Array.from({ length: count }, () => getAction(healthy(habits), context, preferences, 100000, rng));
}

describe("earned habits adjust motivation while explicit settings remain authoritative", () => {
  it("keeps neutral habits and learning OFF byte-equivalent to the original profile and seeded choices", () => {
    const neutral = { ...DEFAULT_COMPANION_HABITS }, learned = trained("played"), disabled = { ...prefs, learnFromYou: false };
    expect(JSON.stringify(getCompanionBehaviorProfile(prefs, neutral))).toBe(JSON.stringify(getCompanionBehaviorProfile(prefs)));
    expect(JSON.stringify(getCompanionBehaviorProfile(disabled, learned))).toBe(JSON.stringify(getCompanionBehaviorProfile(prefs)));
    expect(JSON.stringify(actions(neutral))).toBe(JSON.stringify(actions(undefined)));
    expect(JSON.stringify(actions(learned, disabled))).toBe(JSON.stringify(actions(undefined, disabled)));
    const transfer: CompanionAction = { kind: "jump", target: { x: 200, y: 580, platformId: "card" }, duration: 950 };
    const context = { ...world, platforms: [floor, { id: "card", x: 150, y: 580, width: 160, kind: "card" as const }] };
    expect(deliberateCompanionAction(healthy(learned), context, disabled, transfer)).toEqual(deliberateCompanionAction(healthy(), context, disabled, transfer));
  });

  it("turns spaced friendly experiences into closer real approaches without changing gait speed", () => {
    const learned = trained("petted"), context = { ...world, pointer: { x: 320, y: 700 } }, options = { ...prefs, jump: false };
    const baseline = actions(undefined, options, context), friendly = actions(learned, options, context);
    const baselineWalks = baseline.filter(action => action.kind === "walk"), friendlyWalks = friendly.filter(action => action.kind === "walk");
    expect(baselineWalks.length).toBeGreaterThan(0); expect(friendlyWalks.length).toBeGreaterThan(0);
    expect(baselineWalks.every(action => action.target.x > context.x)).toBe(true);
    expect(friendlyWalks.every(action => action.target.x < context.x)).toBe(true);
    const loved = getCompanionBehaviorProfile(prefs, learned), before = getCompanionBehaviorProfile(prefs);
    expect(loved.pointerGap).toBeLessThan(before.pointerGap);
    expect(loved.socialPull).toBeGreaterThan(before.socialPull);
    expect(loved.walkSpeed).toBe(before.walkSpeed);
    expect(friendly.some(action => action.kind === "heart")).toBe(false);
  });

  it("lets repeated friendly handling earn an existing cat's social gaze cue while keeping its species habits", () => {
    const options = { ...prefs, animalMode: "cat" as const }, context = { ...world, pointer: { x: 320, y: 700 } };
    const look: CompanionAction = { kind: "look", target: { x: world.x, y: world.y, platformId: floor.id }, duration: 700 };
    expect(deliberateCompanionAction(healthy(), context, options, look)).toBe(look);
    const learned = trained("petted"), social = deliberateCompanionAction(healthy(learned), context, options, look);
    expect(social).toMatchObject({ ...look, direction: -1, attention: { kind: "social", point: context.pointer } });
    expect(getCompanionBehaviorProfile(options, learned).scootChance).toBe(0);
    expect(getCompanionBehaviorProfile(options, learned).highPlaceWeight).toBe(getCompanionBehaviorProfile(options).highPlaceWeight);
    expect(deliberateCompanionAction(healthy(learned), context, { ...options, learnFromYou: false }, look)).toBe(look);
  });

  it("distinguishes shared play from cautious handling through actual motivation and consideration pacing", () => {
    const playful = trained("played"), cautious = trained("bonked"), play = getCompanionBehaviorProfile(prefs, playful), wary = getCompanionBehaviorProfile(prefs, cautious), neutral = getCompanionBehaviorProfile(prefs);
    expect(play.playWeight).toBeGreaterThan(neutral.playWeight); expect(play.movementWeight).toBeGreaterThan(neutral.movementWeight);
    expect(wary.lookWeight).toBeGreaterThan(neutral.lookWeight); expect(wary.pointerGap).toBeGreaterThan(neutral.pointerGap);
    expect(wary.movementWeight).toBeLessThan(play.movementWeight);
    expect(cautious.confidence).toBeLessThan(0); expect(playful.confidence).toBeGreaterThan(0);
    const support: Platform = { id: "card", x: 360, y: 580, width: 160, kind: "card" }, context = { ...world, platforms: [floor, support] };
    const candidate: CompanionAction = { kind: "jump", target: { x: 420, y: support.y, platformId: support.id }, duration: 950 };
    const confident = deliberateCompanionAction(healthy(playful), context, prefs, candidate), uncertain = deliberateCompanionAction(healthy(cautious), context, prefs, candidate);
    expect(confident.attention?.kind).toBe("inspect"); expect(uncertain.attention?.kind).toBe("inspect");
    expect(uncertain.duration).toBeGreaterThan(confident.duration);
    expect(uncertain.target).toEqual(confident.target);
  });

  it("preserves all chosen species, personality and gait abilities at every learned-trait corner", () => {
    const corners: CompanionHabits[] = [];
    for (const sociability of [-1, 1]) for (const playfulness of [-1, 1]) for (const confidence of [-1, 1]) corners.push({ sociability, playfulness, confidence, credit: 0, generation: 0 });
    const fixed = ["walkSpeed", "stepMin", "stepRange", "walkScale", "hopHeight", "highPlaceWeight", "exploreEnergy", "exploreCuriosity", "restEnergy", "restedEnergy", "sleepEnergy", "accidentChance"] as const;
    for (const animalMode of ["default", "cat", "dog"] as const) for (const personality of ["curious", "affectionate", "sleepy"] as const) for (const speed of ["relaxed", "normal", "lively"] as const) {
      const options = { ...prefs, animalMode, personality, speed }, serialized = JSON.stringify(options), baseline = getCompanionBehaviorProfile(options);
      for (const corner of corners) {
        const result = getCompanionBehaviorProfile(options, corner);
        for (const key of fixed) expect(result[key], `${animalMode}/${personality}/${speed}/${key}`).toBe(baseline[key]);
        expect(Object.values(result).every(Number.isFinite)).toBe(true);
        expect(result.movementWeight).toBeGreaterThanOrEqual(baseline.movementWeight * .7 - 1e-12);
        expect(result.movementWeight).toBeLessThanOrEqual(baseline.movementWeight * 1.3 + 1e-12);
        expect(result.playWeight).toBeGreaterThanOrEqual(baseline.playWeight * .65 - 1e-12);
        expect(result.playWeight).toBeLessThanOrEqual(baseline.playWeight * 1.35 + 1e-12);
        expect(result.scootChance).toBeLessThanOrEqual(.98); expect(result.pointerStep).toBeLessThanOrEqual(180);
        if (animalMode === "cat") expect(result.scootChance).toBe(0);
      }
      expect(JSON.stringify(options)).toBe(serialized);
    }
  });

  it("never learns permission to use a disabled navigation, meal, sleep or prank ability", () => {
    const habits: CompanionHabits = { sociability: 1, playfulness: 1, confidence: 1, credit: 1, generation: 0 };
    const support: Platform = { ...floor, heart: { x: 500, y: 680 }, kind: "card" }, next: Platform = { id: "next", x: 360, y: 580, width: 240, kind: "card" };
    const context = { ...world, platforms: [support, next], hideAvailable: true, foods: [{ id: "offered", x: 510, y: floor.y, platformId: floor.id, kind: "apple" as const }] };
    const brain = { ...healthy(habits), hunger: .8, energy: .25, activeMs: 100000 };
    const gates: Array<{ patch: Partial<CompanionPreferences>; forbidden: CompanionAction["kind"][] }> = [
      { patch: { enabled: false }, forbidden: ["walk", "jump", "heart", "hide", "eat", "sleep", "panel"] },
      { patch: { roam: false }, forbidden: ["walk", "jump", "heart", "hide", "panel"] },
      { patch: { jump: false }, forbidden: ["jump"] },
      { patch: { heartPrank: false }, forbidden: ["heart"] },
      { patch: { ambientPrank: false }, forbidden: ["hide"] },
      { patch: { feeding: false }, forbidden: ["eat"] },
      { patch: { sleep: false }, forbidden: ["sleep"] },
      { patch: { panelPrank: false }, forbidden: ["panel"] },
    ];
    for (const { patch, forbidden } of gates) {
      const options = { ...prefs, feeding: false, heartPrank: true, ambientPrank: true, panelPrank: true, ...patch };
      for (const draw of [0, .15, .4, .65, .9, .9999]) {
        const action = getAction(brain, context, options, 100000, () => draw);
        expect(forbidden).not.toContain(action.kind);
        if (options.sleep === false) expect(action.intention?.kind).not.toBe("rest");
      }
    }
  });

  it("never trains traits from active-time care, automatic choices, commits or ordinary brain events", () => {
    let brain = healthy(trained("played")), now = 0;
    const initial = traits(brain.habits);
    for (let index = 0; index < 48; index++) {
      now += 500;
      brain = advanceBrain(brain, 500);
      const choice = getAction(brain, world, prefs, now, () => .5);
      brain = commitAction(brain, choice, now);
      for (const event of ["landed", "rested", "woke", "ate", "heart-blocked", "food-lost", "handled", "dragged", "petted"] as const) brain = recordCompanionEvent(brain, event);
      expect(traits(brain.habits)).toEqual(initial);
    }
    expect(brain.habits?.credit).toBe(1);
    const explicit = learnCompanionHabits(brain.habits, "petted");
    expect(traits(explicit)).not.toEqual(initial); expect(explicit.credit).toBe(0);
    const frozen = advanceBrain({ ...brain, habits: explicit }, 30000, false);
    expect(frozen.habits).toBe(explicit);
  });
});
