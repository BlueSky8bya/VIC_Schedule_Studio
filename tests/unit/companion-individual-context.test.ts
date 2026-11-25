import { describe, expect, it } from "vitest";
import { createBrain, getAction, type CompanionBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { deliberateCompanionAction } from "@/lib/ui/viewer-companion/deliberation";
import { advanceCompanionIndividuality, learnCompanionIndividuality, normalizeCompanionIndividuality, type CompanionIndividualContext, type CompanionIndividualExperience } from "@/lib/ui/viewer-companion/individuality";
import { planCompanionGoal } from "@/lib/ui/viewer-companion/planner";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

function trained(where: CompanionIndividualContext, event: CompanionIndividualExperience = "home-called") {
  let learning = normalizeCompanionIndividuality(undefined);
  for (let index = 0; index < 24; index++) {
    learning = learnCompanionIndividuality(advanceCompanionIndividuality(learning, 18000, true), event, where, where === "home" ? "home" : "card", true);
  }
  return learning;
}

function fixture(where: CompanionIndividualContext) {
  const support: Platform = { id: where === "home" ? "companion-home-floor" : "card", kind: where === "home" ? "floor" : "card", x: 0, y: 500, width: 600 };
  const world: CompanionWorld = { x: 300, y: 500, platformId: support.id, platforms: [support], width: 1000, height: 800, animated: true };
  const brain: CompanionBrain = { ...createBrain(0, () => .5), activeMs: 100000, energy: .7, hunger: .1, curiosity: .4 };
  const preferences = { ...DEFAULT_COMPANION_PREFERENCES, personality: "balanced" as const };
  return { support, world, brain, preferences };
}

describe.each(["home", "outside"] as const)("individuality uses the occupied %s context", where => {
  const other = where === "home" ? "outside" : "home";

  it("changes finite local choices only from the current context", () => {
    const { world, brain, preferences } = fixture(where);
    const quiet = { ...preferences, roam: false, jump: false, sleep: false, feeding: false };
    const choose = (individuality?: CompanionBrain["individuality"]) => getAction({ ...brain, individuality }, { ...world, animated: false }, quiet, 100000, () => 0);
    const baseline = choose();
    expect(baseline.kind).toBe("idle");
    expect(choose(trained(where)).duration).toBeGreaterThan(baseline.duration);
    expect(choose(trained(other))).toEqual(baseline);
  });

  it("keeps an accepted rest goal but applies only its current-context rhythm", () => {
    const { support, world, brain, preferences } = fixture(where);
    const ports = { route: () => [], reachable: () => [], landingX: (_: Platform, x: number) => x };
    const resting: CompanionBrain = { ...brain, energy: .3, intention: { kind: "rest", targetId: support.id, offset: .5, remaining: 12, stage: "travel" } };
    const choose = (individuality?: CompanionBrain["individuality"]) => planCompanionGoal({ ...resting, individuality }, world, preferences, ports).action!;
    const baseline = choose();
    expect(baseline.kind).toBe("sleep");
    expect(choose(trained(where)).duration).toBeGreaterThan(baseline.duration);
    expect(choose(trained(other))).toEqual(baseline);
  });

  it("adapts real pre-travel observation to the context where discovery was shared", () => {
    const { support, world, brain, preferences } = fixture(where);
    const candidate: CompanionAction = { kind: "walk", target: { x: 400, y: 500, platformId: support.id }, duration: 900, intention: { kind: "explore", targetId: support.id, offset: 2 / 3, remaining: 12, stage: "travel" } };
    const choose = (individuality?: CompanionBrain["individuality"]) => deliberateCompanionAction({ ...brain, individuality }, world, preferences, candidate, true);
    const baseline = choose();
    expect(baseline.attention?.kind).toBe("inspect");
    expect(choose(trained(where, "shared-discovery")).duration).toBeLessThan(baseline.duration);
    expect(choose(trained(other, "shared-discovery"))).toEqual(baseline);
  });

  it.each(["off", "cat", "dog"] as const)("keeps %s behavior unaffected by new context memory", mode => {
    const { world, brain, preferences } = fixture(where);
    const quiet = { ...preferences, roam: false, jump: false, sleep: false, feeding: false, ...(mode === "off" ? { learnFromYou: false } : { animalMode: mode }) };
    const choose = (individuality?: CompanionBrain["individuality"]) => getAction({ ...brain, individuality }, { ...world, animated: false }, quiet, 100000, () => 0);
    expect(choose(trained(where))).toEqual(choose());
  });
});
