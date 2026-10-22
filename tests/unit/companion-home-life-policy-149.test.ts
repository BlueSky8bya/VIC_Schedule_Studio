import { describe, expect, it, vi } from "vitest";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_HOME_LIFE_POLICY, companionHomeLifePhaseFor, createCompanionHomeLifePolicy, planCompanionHomeLifeControl, type CompanionHomeLifeInput } from "@/lib/ui/viewer-companion/home-life-policy";
import { createBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import type { PersonalitySceneRecipe, SceneBeat } from "@/lib/ui/viewer-companion/personality-scene-catalog";

const input = (patch: Partial<CompanionHomeLifeInput> = {}): CompanionHomeLifeInput => ({
  phase: "awake", personality: "balanced", night: true, inside: true, enabled: true, active: true,
  lightLit: false, tv: "off", canLight: true, canTv: true, ...patch,
});

describe("149 continuous room life policy", () => {
  it.each(COMPANION_PERSONALITIES)("requires light for %s's awake night care and prefers it in daytime", personality => {
    for (const night of [true, false]) {
      const draw = vi.fn(() => 0), policy = createCompanionHomeLifePolicy(draw), state = input({ personality, night, tv: "nature" });
      const before = JSON.stringify(state), first = policy.next(state);
      expect(first).toMatchObject({ status: "command", command: { kind: "light", lit: true, required: night } });
      expect(policy.next(state)).toEqual(first); expect(draw).not.toHaveBeenCalled();
      expect(policy.next({ ...state, lightLit: true })).toMatchObject({ status: "ready", plan: { serial: first.plan!.serial } });
      expect(JSON.stringify(state)).toBe(before);
    }
  });

  it("allows occasional dark homebody TV, not dark eating/tidying/music or other personalities", () => {
    for (const personality of COMPANION_PERSONALITIES) {
      const watched = createCompanionHomeLifePolicy(() => 0).next(input({ phase: "watch", personality, tv: "tori", lightLit: true }));
      if (personality === "homebody") expect(watched).toMatchObject({ status: "command", command: { kind: "light", lit: false }, plan: { exception: "dark-homebody-tv" } });
      else expect(watched.status).toBe("ready");
      expect(createCompanionHomeLifePolicy(() => 0).next(input({ phase: "awake", personality })).command).toMatchObject({ kind: "light", lit: true });
    }
    expect(createCompanionHomeLifePolicy(() => COMPANION_HOME_LIFE_POLICY.darkHomebodyTvChance).next(input({ phase: "watch", personality: "homebody" })).command).toMatchObject({ kind: "light", lit: true });
  });

  it.each(["sleep", "outside"] as const)("finishes %s's actual TV/light state before admitting the original action", phase => {
    const draw = vi.fn(() => .9), policy = createCompanionHomeLifePolicy(draw), state = input({ phase, tv: "nature", lightLit: true });
    const first = policy.next(state);
    expect(first.command).toEqual({ kind: "tv", state: "off", required: true });
    expect(policy.next(state).command).toEqual(first.command); // Labels or an attempted interaction never ACK.
    expect(policy.next({ ...state, tv: "off" }).command).toEqual({ kind: "light", lit: false, required: true });
    expect(policy.next({ ...state, tv: "off", lightLit: false })).toMatchObject({ status: "ready", plan: { serial: first.plan!.serial } });
    expect(draw).toHaveBeenCalledTimes(1);
  });

  it.each(["sleep", "outside"] as const)("commits %s's tiny Tori exception once, without per-frame rerolls", phase => {
    const draw = vi.fn(() => 0), policy = createCompanionHomeLifePolicy(draw), state = input({ phase, tv: "off", lightLit: true });
    const first = policy.next(state);
    expect(first.command).toEqual({ kind: "tv", state: "tori", required: true });
    for (let i = 0; i < 30; i++) expect(policy.next(state).plan).toBe(first.plan);
    expect(policy.next({ ...state, tv: "tori", lightLit: false }).status).toBe("ready");
    expect(draw).toHaveBeenCalledTimes(1);
    const boundary = phase === "sleep" ? COMPANION_HOME_LIFE_POLICY.sleepToriChance : COMPANION_HOME_LIFE_POLICY.outsideToriChance;
    expect(createCompanionHomeLifePolicy(() => boundary).next(input({ phase, tv: "nature" })).command).toEqual({ kind: "tv", state: "off", required: true });
  });

  it("keeps existing background channels and draws an optional new one only at an initial transition", () => {
    const draw = vi.fn(() => 0), policy = createCompanionHomeLifePolicy(draw), state = input({ allowBackground: true });
    const first = policy.next(state);
    expect(first.command).toMatchObject({ kind: "light", lit: true });
    expect(policy.next({ ...state, lightLit: true }).command).toEqual({ kind: "tv", state: "tori", required: false });
    expect(policy.next({ ...state, lightLit: true, allowBackground: false }).status).toBe("ready");
    expect(policy.next({ ...state, lightLit: true, tv: "tori" }).status).toBe("ready");
    expect(draw).toHaveBeenCalledTimes(1);
    for (const tv of ["nature", "cooking", "toys", "moon", "tori", "music"] as const) {
      const existingDraw = vi.fn(() => 0);
      expect(createCompanionHomeLifePolicy(existingDraw).next(input({ tv, lightLit: true, allowBackground: true })).status).toBe("ready");
      expect(existingDraw).not.toHaveBeenCalled();
    }
    const lateDraw = vi.fn(() => 0), late = createCompanionHomeLifePolicy(lateDraw);
    late.next(input({ lightLit: true }));
    expect(late.next(input({ lightLit: true, allowBackground: true })).status).toBe("ready");
    expect(lateDraw).not.toHaveBeenCalled();
  });

  it("respects manual priority, keeps independent controls available, and retries the same goal after release", () => {
    const draw = vi.fn(() => .9), policy = createCompanionHomeLifePolicy(draw), state = input({ phase: "outside", tv: "tori", lightLit: true, canTv: false });
    const light = policy.next(state);
    expect(light.command).toEqual({ kind: "light", lit: false, required: true });
    expect(policy.next({ ...state, lightLit: false })).toMatchObject({ status: "blocked", reason: "manual-tv" });
    expect(policy.next({ ...state, lightLit: false, canTv: true })).toMatchObject({ status: "command", command: { kind: "tv", state: "off" }, plan: { serial: light.plan!.serial } });
    expect(draw).toHaveBeenCalledTimes(1);
    const awake = createCompanionHomeLifePolicy(() => 0), protectedNight = input({ canLight: false, allowBackground: true });
    const blocked = awake.next(protectedNight);
    expect(blocked).toMatchObject({ status: "blocked", reason: "manual-light" });
    expect(awake.next({ ...protectedNight, canLight: true })).toMatchObject({ status: "command", command: { kind: "light", lit: true }, plan: { serial: blocked.plan!.serial } });
  });

  it("does not mutate controls or draw exceptions while OFF, inactive, owned, or already outside", () => {
    for (const patch of [{ enabled: false }, { active: false }, { owned: true }, { inside: false }]) {
      const draw = vi.fn(() => 0), policy = createCompanionHomeLifePolicy(draw);
      expect(policy.next(input({ ...patch, phase: "outside" })).status).toBe("blocked");
      expect(draw).not.toHaveBeenCalled(); expect(policy.current()).toBeUndefined();
    }
    const policy = createCompanionHomeLifePolicy(() => 0); policy.next(input({ phase: "sleep" }));
    expect(policy.current()).toBeDefined(); policy.next(input({ enabled: false })); expect(policy.current()).toBeUndefined();
  });

  it("resamples only a changed life phase/personality/night, never ACK state or a repeated decision", () => {
    const draw = vi.fn().mockReturnValueOnce(0).mockReturnValue(.9), policy = createCompanionHomeLifePolicy(draw);
    const dark = policy.next(input({ phase: "watch", personality: "homebody", tv: "tori", lightLit: true }));
    expect(policy.next(input({ phase: "watch", personality: "homebody", tv: "tori", lightLit: false })).plan).toBe(dark.plan);
    const awake = policy.next(input({ phase: "awake", personality: "homebody" })); expect(awake.command).toMatchObject({ kind: "light", lit: true });
    const watchedAgain = policy.next(input({ phase: "watch", personality: "homebody" }));
    expect(watchedAgain.plan!.serial).toBeGreaterThan(dark.plan!.serial); expect(watchedAgain.plan?.exception).toBeUndefined();
    expect(draw).toHaveBeenCalledTimes(2);
  });

  it("keeps optional naps independent of TV and suppresses bad exception draws", () => {
    expect(createCompanionHomeLifePolicy(() => 0).next(input({ phase: "nap", lightLit: true, tv: "tori" })).command).toEqual({ kind: "light", lit: false, required: false });
    expect(createCompanionHomeLifePolicy(() => .9).next(input({ phase: "nap", lightLit: true, tv: "nature" })).status).toBe("ready");
    for (const draw of [() => NaN, () => Infinity, () => -1, () => { throw Error("unavailable"); }])
      expect(createCompanionHomeLifePolicy(draw).next(input({ phase: "sleep", tv: "nature" })).command).toEqual({ kind: "tv", state: "off", required: true });
    expect(createCompanionHomeLifePolicy().next(input({ phase: "unknown" as CompanionHomeLifeInput["phase"] })).reason).toBe("invalid");
  });

  it("retains the original departure/rest intent and does not darken earlier real work", () => {
    const action = { kind: "look" as const, target: { x: 100, y: 200, platformId: "companion-home-floor" } };
    const command = { kind: "light", lit: false } as const;
    const scene = (steps: readonly SceneBeat[]) => ({ id: "authored", beat: 0, command, steps });
    expect(companionHomeLifePhaseFor({ action, inside: true, night: true, scene: scene([command, { kind: "sleep", ms: 5000 }]) })).toBe("sleep");
    expect(companionHomeLifePhaseFor({ action, inside: true, night: true, scene: scene([command, { kind: "food", mode: "eat" }, { kind: "sleep", ms: 5000 }]) })).toBe("awake");
    expect(companionHomeLifePhaseFor({ action, inside: true, night: true, scene: scene([command, { kind: "tv", state: "tori" }, { kind: "watch", ms: 2000 }]) })).toBe("watch");
    const sofa = { kind: "go", target: "sofa" } as const;
    expect(companionHomeLifePhaseFor({ action, inside: true, night: true, scene: { ...scene([sofa, { kind: "watch", ms: 2000 }]), command: sofa } })).toBe("watch");
    expect(companionHomeLifePhaseFor({ action, inside: true, night: true, scene: { ...scene([sofa, { kind: "food", mode: "eat" }, { kind: "watch", ms: 2000 }]), command: sofa } })).toBe("awake");
    expect(companionHomeLifePhaseFor({ action: { kind: "walk", target: { x: 500, y: 200, platformId: "actual-calendar" } }, inside: true, night: false })).toBe("outside");
    expect(companionHomeLifePhaseFor({ action: { ...action, kind: "sleep" }, inside: true, night: true, scene: { ...scene([]), id: "routine-nap" } })).toBe("nap");
  });

  it("routes to an actual room stance before offering contact and rejects unrelated/invalid supports", () => {
    const floor: Platform = { id: "companion-home-floor", x: 0, y: 500, width: 700, kind: "floor", manualOnly: true };
    const world: CompanionWorld = { x: 150, y: 500, platformId: floor.id, platforms: [floor], width: 1000, height: 700, animated: true };
    const decision = createCompanionHomeLifePolicy(() => .9).next(input());
    const stance = { x: 330, y: floor.y, platformId: floor.id }, contact = { x: 330, y: 300 };
    const route = planCompanionHomeLifeControl({ decision, world, preferences: DEFAULT_COMPANION_PREFERENCES, stance, contact });
    expect(route).toMatchObject({ kind: "walk", homeLife: { serial: decision.plan!.serial, travel: true }, target: { platformId: floor.id } });
    const touched = planCompanionHomeLifeControl({ decision, world: { ...world, x: stance.x }, preferences: DEFAULT_COMPANION_PREFERENCES, stance, contact });
    expect(touched).toMatchObject({ kind: "play", play: "pounce", homeLife: { interactionContact: contact } });
    expect(touched?.homeLife.travel).toBeUndefined();
    for (const changed of [{ world: { ...world, animated: false } }, { world: { ...world, platformId: "calendar" } }, { contact: { x: NaN, y: 300 } }, { stance: { ...stance, platformId: "companion-home-floor-400" } }])
      expect(planCompanionHomeLifeControl({ decision, world, preferences: DEFAULT_COMPANION_PREFERENCES, stance, contact, ...changed })).toBeUndefined();
  });

  it("walks the remaining near-cord gap on either side before light ON or OFF", () => {
    const floor: Platform = { id: "companion-home-floor", x: 0, y: 500, width: 700, kind: "floor", manualOnly: true };
    const stance = { x: 330, y: floor.y, platformId: floor.id }, contact = { x: 330, y: 300 };
    for (const phase of ["awake", "sleep"] as const) {
      const decision = createCompanionHomeLifePolicy(() => .9).next(input({ phase, lightLit: phase === "sleep" }));
      expect(decision.command?.kind).toBe("light");
      for (const offset of [-24, -20, -12, -2, 2, 12, 20, 24]) {
        const world: CompanionWorld = { ...stance, x: stance.x + offset, platforms: [floor], width: 1000, height: 700, animated: true };
        const job = planCompanionHomeLifeControl({ decision, world, preferences: DEFAULT_COMPANION_PREFERENCES, stance, contact });
        expect(job).toMatchObject({ kind: "walk", target: stance, homeLife: { travel: true } });
        const aligned = planCompanionHomeLifeControl({ decision, world: { ...world, ...stance }, preferences: DEFAULT_COMPANION_PREFERENCES, stance, contact });
        expect(aligned).toMatchObject({ kind: "play", homeLife: { interactionContact: contact } });
      }
      for (const offset of [-1.5, 1.5]) {
        const world: CompanionWorld = { ...stance, y: stance.y + offset, platforms: [floor], width: 1000, height: 700, animated: true };
        expect(planCompanionHomeLifeControl({ decision, world, preferences: DEFAULT_COMPANION_PREFERENCES, stance, contact }))
          .toMatchObject({ kind: "play", homeLife: { interactionContact: contact } });
      }
    }
  });

  it("aligns authored light steps instead of spending them beside the cord", () => {
    const floor: Platform = { id: "companion-home-floor", x: 0, y: 500, width: 700, kind: "floor", manualOnly: true };
    for (const lit of [true, false]) for (const offset of [-20, 8, 0]) {
      const recipes: PersonalitySceneRecipe[] = [{ id: "light-alignment", label: "fixture", personality: "balanced", major: true, triggers: ["free"], steps: [{ kind: "light", lit }, { kind: "watch", ms: 900 }] }];
      const director = createCompanionPersonalityDirector(recipes, () => .5);
      const scene: PersonalitySceneInput = { world: { x: 330 + offset, y: 501.5, platformId: floor.id, platforms: [floor], width: 1000, height: 700, animated: true },
        brain: { ...createBrain(0, () => .5), energy: .9, hunger: .2 }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "balanced" }, now: 0,
        home: { light: { x: 330, y: 500, platformId: floor.id }, contacts: { light: { x: 330, y: 300 } } }, toys: [], tv: "off", lightLit: !lit };
      const entry = director.next(scene)!; director.complete(entry.meta); scene.now = 100;
      const offered = director.next(scene);
      expect(offered?.meta.command).toMatchObject({ kind: "light", lit });
      if (offset) {
        expect(offered?.action?.kind).toBe("walk"); expect(offered?.meta.travel).toBe(true);
        director.complete(offered!.meta); scene.world = { ...scene.world, x: 330, y: 500 }; scene.now = 500;
        expect(director.next(scene)?.action?.kind).toBe("play");
      } else expect(offered?.action?.kind).toBe("play");
    }
  });

  it("normalizes an authored light OFF before comparison, avoiding a needless OFF-then-ON contact", () => {
    const floor: Platform = { id: "companion-home-floor", x: 0, y: 500, width: 700, kind: "floor", manualOnly: true };
    const recipes: PersonalitySceneRecipe[] = [{ id: "policy-proof", label: "fixture", personality: "balanced", major: true, triggers: ["free"], steps: [{ kind: "light", lit: false }, { kind: "watch", ms: 900 }] }];
    const director = createCompanionPersonalityDirector(recipes, () => .5);
    const normalized = vi.fn((command: Extract<SceneBeat, { kind: "light" | "tv" }>) => command.kind === "light" ? { ...command, lit: true } : command);
    const scene: PersonalitySceneInput = {
      world: { x: 150, y: 500, platformId: floor.id, platforms: [floor], width: 1000, height: 700, animated: true },
      brain: { ...createBrain(0, () => .5), energy: .9, hunger: .2 }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "balanced" }, now: 0,
      home: { light: { x: 400, y: 500, platformId: floor.id }, contacts: { light: { x: 400, y: 300 } } }, toys: [], tv: "off", lightLit: true, homeLifeControl: normalized,
    };
    const entry = director.next(scene)!; director.complete(entry.meta);
    scene.now = 100; const offer = director.next(scene);
    expect(normalized).toHaveBeenCalled(); expect(offer?.meta.command.kind).toBe("watch");
    expect(offer?.meta.travel).toBeUndefined(); expect(offer?.action?.target.x).toBe(scene.world.x);
    expect(recipes[0].steps[0]).toEqual({ kind: "light", lit: false });
  });
});
