import { describe, expect, it, vi } from "vitest";
import { createBrain, type CompanionAction, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type PersonalitySceneInput, type PersonalitySceneProposal } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES, type SceneBeat } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { companionHomeLifePhaseFor, createCompanionHomeLifePolicy, planCompanionHomeLifeControl, type CompanionHomeLifeInput } from "@/lib/ui/viewer-companion/home-life-policy";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { accessibleCompanionToys, createCompanionToys, findCompanionToyRoute } from "@/lib/ui/viewer-companion/toys";
import { companionToyReturnDelivered, companionToyReturnTarget, sampleCompanionToyReturn } from "@/lib/ui/viewer-companion/toy-return";

const floor: Platform = { id: "companion-home-floor", kind: "floor", x: 0, y: 600, width: 700, manualOnly: true };
const sofa: Platform = { id: "companion-home", kind: "floor", x: 30, y: 560, width: 160 };
const foodFloor: Platform = { ...floor, id: "companion-home-floor-food" };
const recipe = COMPANION_PERSONALITY_SCENES.find(value => value.id === "S03")!;
const box = { x: 500, y: 600, platformId: floor.id };

/** Actual toy storage and proved body routes, followed by the real director
 * and household policy. Contact is an explicit checked unit-host ACK;
 * native decoded poses/contact remain a separate required browser proof. */
function returnedToy() {
  const model = createCompanionToys(() => 0);
  model.sync([floor, sofa], { width: 900, height: 720 }, 0, [foodFloor]);
  expect(model.spawn({ x: 240, y: 530, platformId: foodFloor.id }, 0)).toBeTruthy();
  for (let at = 0; at <= 3000; at += 16) model.tick(at);
  const scene: PersonalitySceneInput = {
    world: { x: 180, y: 600, platformId: floor.id, platforms: [floor, sofa], width: 900, height: 720, animated: true, foods: [] },
    brain: { ...createBrain(0, () => .5), energy: .05, hunger: .05 }, now: 3000,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "sleepy", sleep: true, learnFromYou: false },
    home: { box, sofa: { x: 100, y: 560, platformId: sofa.id } }, toys: accessibleCompanionToys(model.available(), [floor, sofa]), tv: "off",
  };
  const director = createCompanionPersonalityDirector([recipe]);
  const entry = director.next(scene)!; scene.now += entry.action!.duration; director.complete(entry.meta);
  const returned = director.next(scene)!; expect(returned.delegate).toMatchObject({ kind: "toy", mode: "return" });
  const id = returned.meta.itemId!, actual = scene.toys.find(value => value.id === id)!;
  const move = (target: CompanionAction["target"]) => {
    const plane = scene.world.platforms.find(value => value.id === target.platformId)!;
    expect(plane).toBeTruthy(); expect(target.y).toBe(plane.y);
    expect(target.x).toBeGreaterThanOrEqual(plane.x); expect(target.x).toBeLessThanOrEqual(plane.x + plane.width);
    scene.now += Math.max(220, Math.hypot(target.x-scene.world.x, target.y-scene.world.y) / 100 * 1000);
    scene.world = { ...scene.world, ...target };
    if (model.carried()) expect(model.carry(id, { x: scene.world.x, y: scene.world.y - 30 })).toBe(true);
    director.observeProgress({ now: scene.now, active: true, point: scene.world, carriedToyId: model.carried() });
  };
  const route = (target: CompanionAction["target"]) => {
    const steps = findCompanionToyRoute(scene.world, target, scene.world.platforms, true, true);
    expect(steps).toBeTruthy(); for (const step of steps!) move(step.target);
  };
  route(actual.stance ?? actual); expect(model.pick(id, scene.world)).toBe(true); route(box);
  const opening = companionToyReturnTarget({ left: 470, top: 525, width: 60, height: 25 })!;
  expect(model.carry(id, sampleCompanionToyReturn(model.items().find(value => value.id === id)!, opening, 1))).toBe(true);
  expect(companionToyReturnDelivered(model.items().find(value => value.id === id), opening)).toBe(true);
  expect(model.stash(id)).toBe(true); director.resolve(returned.meta, true, id, scene.now);
  scene.toys = []; scene.toyCount = 0; scene.carriedToyId = undefined;
  expect(model.count()).toBe(0); expect(director.current()).toMatchObject({ id: "S03", beat: 1 });
  return { scene, director, move, route };
}

describe("157 owned rest-plan handoff to physical household policy", () => {
  it.each(["walk", "jump"] as const)("keeps an authored outside goal through a room-floor %s route leg", kind => {
    const action = {kind, target:{x:300,y:600,platformId:floor.id}};
    const scene = {id:"D157-C",beat:2,command:{kind:"go" as const,target:"outside" as const}};
    expect(companionHomeLifePhaseFor({action,inside:true,night:true,scene})).toBe("outside");
    expect(companionHomeLifePhaseFor({action,inside:true,night:true})).toBe("awake");
    expect(companionHomeLifePhaseFor({action,inside:true,night:false,scene:{...scene,command:{kind:"go",target:"local-floor"}}})).toBe("awake");
  });
  it.each([
    { night: false, initialLight: false, roll: .1, expectedLight: false },
    { night: false, initialLight: true, roll: .1, expectedLight: false },
    { night: false, initialLight: false, roll: .9, expectedLight: false },
    { night: false, initialLight: true, roll: .9, expectedLight: true },
    { night: true, initialLight: false, roll: .9, expectedLight: false },
    { night: true, initialLight: true, roll: .9, expectedLight: false },
  ])("keeps S03 sofa/cozy/sleep in one committed phase: %j", ({ night, initialLight, roll, expectedLight }) => {
    const { scene, director, move } = returnedToy(), draw = vi.fn(() => roll), policy = createCompanionHomeLifePolicy(draw);
    let lit = initialLight, tv: CompanionHomeLifeInput["tv"] = "nature", enteredSofa = false;
    const effects: { kind: string; lit?: boolean; tv?: string }[] = [], phases: string[] = [], stages = new Set<number>();
    const policyInput = (phase: CompanionHomeLifeInput["phase"]): CompanionHomeLifeInput => ({ phase, personality: "sleepy", night, inside: true,
      enabled: scene.preferences.enabled && scene.preferences.roam, active: scene.world.animated === true && scene.world.paused !== true,
      lightLit: lit, tv, canLight: true, canTv: true, allowBackground: false });
    for (let iteration = 0; iteration < 14 && !director.completed().includes("S03"); iteration++) {
      const offered = director.next(scene)!; expect(offered?.meta.id).toBe("S03"); expect(offered.action).toBeTruthy();
      const context = director.homeLifeScene(offered.meta)!;
      expect(context).toBeTruthy(); expect(context.command).toEqual(recipe.steps[offered.meta.beat]);
      const phase = companionHomeLifePhaseFor({ action: offered.action!, inside: true, night, scene: context });
      phases.push(phase); stages.add(offered.meta.beat); expect(phase).toBe(night ? "sleep" : "nap");
      const beforeControls = effects.length;
      for (let contact = 0; contact < 12; contact++) {
        const decision = policy.next(policyInput(phase));
        if (decision.status === "ready") break;
        expect(decision.status).toBe("command");
        const stance = { x: decision.command!.kind === "light" ? 400 : 350, y: floor.y, platformId: floor.id };
        const point = { x: stance.x, y: 540 };
        const physical = planCompanionHomeLifeControl({ decision, world: scene.world, preferences: scene.preferences, stance, contact: point })!;
        expect(physical).toBeTruthy();
        if (physical.homeLife.travel) { move(physical.target); continue; }
        expect(scene.world.platformId).toBe(floor.id); expect(Math.abs(scene.world.x-stance.x)).toBeLessThanOrEqual(24);
        expect(physical.homeLife.interactionContact).toEqual(point);
        expect(policy.next(policyInput(phase)).command).toEqual(decision.command); // A gesture offer cannot acknowledge itself.
        if (decision.command!.kind === "light") { lit = decision.command!.lit; effects.push({ kind: "light", lit }); }
        else { tv = decision.command!.state; effects.push({ kind: "tv", tv }); }
        scene.now += physical.duration; director.observeProgress({ now: scene.now, active: true, point: scene.world });
        expect(director.owns(offered.meta)).toBe(true); // Control trips do not consume the original source beat.
      }
      expect(policy.next(policyInput(phase)).status).toBe("ready");
      if (enteredSofa) expect(effects.length, "no lamp errand may send a prepared rest back out of its sofa").toBe(beforeControls);
      if (["walk", "jump"].includes(offered.action!.kind)) {
        const route = findCompanionToyRoute(scene.world, offered.action!.target, scene.world.platforms, true, true);
        expect(route).toBeTruthy(); for (const step of route!) move(step.target);
        if (scene.world.platformId === sofa.id) enteredSofa = true;
      } else {
        expect(scene.world.platformId).toBe(sofa.id); expect(enteredSofa).toBe(true);
        if (offered.meta.beat === 2) expect(offered.action?.play).toBe("cozy-nest");
        if (offered.meta.beat === 3) expect(offered.action).toMatchObject({ kind: "sleep", duration: 5500 });
        scene.now += offered.action!.duration;
        director.observeProgress({ now: scene.now, active: true, point: scene.world });
      }
      director.complete(offered.meta); scene.now += 220;
    }
    expect(director.completed()).toContain("S03"); expect(stages).toEqual(new Set([1, 2, 3]));
    expect(new Set(phases)).toEqual(new Set([night ? "sleep" : "nap"])); expect(draw).toHaveBeenCalledTimes(1);
    expect(lit).toBe(expectedLight); expect(tv).toBe(night ? "off" : "nature");
    expect(effects.filter(value => value.kind === "light")).toEqual(initialLight && !expectedLight ? [{ kind: "light", lit: false }] : []);
  });

  it("exposes only a frozen current same-serial source plan, rejecting cancelled/stale/foreign metadata", () => {
    const { scene, director } = returnedToy(), offer = director.next(scene)!;
    const before = JSON.stringify(recipe), context = director.homeLifeScene(offer.meta)!;
    expect(Object.isFrozen(context)).toBe(true); expect(Object.isFrozen(context.steps)).toBe(true);
    expect(context.steps).not.toBe(recipe.steps); expect(context.steps.every(Object.isFrozen)).toBe(true);
    expect(director.homeLifeScene({ ...offer.meta, command: { kind: "sleep", ms: 7000 } })?.command).toEqual({ kind: "go", target: "sofa" });
    for (const meta of [{ ...offer.meta, serial: offer.meta.serial + 1 }, { ...offer.meta, id: "S04" }, { ...offer.meta, beat: offer.meta.beat + 1 }])
      expect(director.homeLifeScene(meta)).toBeUndefined();
    expect(JSON.stringify(recipe)).toBe(before); director.cancel(); expect(director.homeLifeScene(offer.meta)).toBeUndefined();
  });

  it.each(["cozy-nest", "doze-curl"] as const)("does not treat a generic/terminal %s or a later work barrier as a rest plan", pose => {
    const command: SceneBeat = { kind: "pose", pose }, action = { kind: "play" as const, target: { x: 100, y: 560, platformId: sofa.id } };
    expect(companionHomeLifePhaseFor({ action, inside: true, night: true, scene: { id: "unknown", beat: 0, command } })).toBe("awake");
    expect(companionHomeLifePhaseFor({ action, inside: true, night: true, scene: { id: "terminal", beat: 0, command, steps: [command] } })).toBe("awake");
    for (const work of [{ kind: "food", mode: "eat" }, { kind: "toy", mode: "return" }, { kind: "wash", ms: 2000 }, { kind: "watch", ms: 2000 }, { kind: "go", target: "outside" }] as const) {
      const context = { id: "actual-work-before-rest", beat: 0, command, steps: [command, work, { kind: "sleep", ms: 5500 } as const] };
      expect(companionHomeLifePhaseFor({ action, inside: true, night: true, scene: context })).toBe("awake");
      const awake = createCompanionHomeLifePolicy(() => .9).next({ phase: companionHomeLifePhaseFor({ action, inside: true, night: true, scene: context }),
        personality: "sleepy", night: true, inside: true, enabled: true, active: true, lightLit: false, tv: "nature" });
      expect(awake.command).toMatchObject({ kind: "light", lit: true });
    }
  });

  it("preserves manual/OFF ownership before the same needed source rest instead of acknowledging or moving remotely", () => {
    const { scene, director } = returnedToy(), offered: PersonalitySceneProposal = director.next(scene)!;
    const context = director.homeLifeScene(offered.meta)!, phase = companionHomeLifePhaseFor({ action: offered.action!, inside: true, night: true, scene: context });
    const draw = vi.fn(() => .9), policy = createCompanionHomeLifePolicy(draw), position = { ...scene.world };
    const state: CompanionHomeLifeInput = { phase, personality: "sleepy", night: true, inside: true, enabled: true, active: true, lightLit: true, tv: "off", canLight: false };
    const blocked = policy.next(state); expect(blocked).toMatchObject({ status: "blocked", reason: "manual-light" });
    expect(planCompanionHomeLifeControl({ decision: blocked, world: scene.world, preferences: scene.preferences })).toBeUndefined();
    expect(scene.world).toEqual(position); expect(director.owns(offered.meta)).toBe(true); expect(director.completed()).toEqual([]);
    const released = policy.next({ ...state, canLight: true }); expect(released).toMatchObject({ command: { kind: "light", lit: false }, plan: { serial: blocked.plan!.serial } });
    expect(draw).toHaveBeenCalledTimes(1);
    for (const patch of [{ enabled: false }, { active: false }, { owned: true }]) {
      const quiet = createCompanionHomeLifePolicy(() => { throw Error("OFF/owned cannot draw"); }).next({ ...state, ...patch });
      expect(quiet.status).toBe("blocked"); expect(quiet.command).toBeUndefined(); expect(scene.world).toEqual(position);
    }
  });
});
