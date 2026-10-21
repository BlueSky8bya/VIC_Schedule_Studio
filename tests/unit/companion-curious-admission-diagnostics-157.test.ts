import { describe, expect, it, vi } from "vitest";
import { createBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type CompanionToyAdmissionObserver, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
const floor: Platform = { id: "companion-home-floor", x: 0, y: 600, width: 700, kind: "floor", manualOnly: true };
const loft: Platform = { id: "actual-unreachable-box", x: 800, y: 100, width: 90, kind: "date" };
const recipes = COMPANION_PERSONALITY_SCENES.filter(recipe => ["C01", "C07", "C09"].includes(recipe.id));
function input(): PersonalitySceneInput {
  return { world: { x: 100, y: 600, platformId: floor.id, platforms: [floor, loft], width: 1100, height: 720, animated: true, foods: [] },
    brain: { ...createBrain(0, () => .5), hunger: .05, energy: .95 }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "curious", roam: true, feeding: false },
    now: 0, home: { box: { x: 840, y: 100, platformId: loft.id } },
    toys: [{ id: "actual-kaleidoscope-79", kind: "kaleidoscope", x: 260, y: 600, platformId: floor.id, angle: 0, held: false, carried: false }], tv: "off" };
}
function run(sink?: CompanionToyAdmissionObserver) {
  const state = input(), rng = vi.fn(() => .5), director = createCompanionPersonalityDirector(recipes,rng,undefined,sink);
  const trace: unknown[] = [], entry = director.next(state)!; trace.push(entry); director.complete(entry.meta); state.now += entry.action!.duration;
  for (let index=0;index<12;index++) { state.toys = [{ ...state.toys[0], id: `actual-kaleidoscope-${79+index}` }]; trace.push(director.next(state)); state.now += 10; }
  return { trace, state, draws: rng.mock.calls.length, current: director.current(), completed: director.completed() };
}
describe("157 opt-in curious toy admission facts", () => {
  it("records actual return-route rejection with bounded immutable copied facts and no invented object", () => {
    const facts: Readonly<Record<string,unknown>>[] = []; run(fact => facts.push(fact));
    expect(facts.length).toBe(8); expect(facts.every(Object.isFrozen)).toBe(true);
    const rejected = facts.find(fact => fact.recipe === "C07" && fact.reason === "return-route-unavailable")!;
    expect(rejected).toBeTruthy(); expect(rejected).toMatchObject({ admitted: false, hunger: .05, energy: .95, requiredReturn: true, returnRouteAvailable: false, from: { x:100,y:600,platformId:floor.id } });
    expect(rejected.toys).toEqual([expect.objectContaining({ id: "actual-kaleidoscope-79", kind: "kaleidoscope", platformId: floor.id, stance: { x:260,y:600,platformId:floor.id }, pickRouteLength: 1, returnRouteLength: null })]);
    expect(facts.some(fact => fact.recipe === "C01" && fact.reason === "missing-trigger")).toBe(true);
    expect(facts.some(fact => fact.recipe === "C09" && fact.reason === "insufficient-comparison-items")).toBe(true);
  });
  it("leaves every actual proposal, selected owner, model input and RNG count identical to the absent observer", () => {
    const plain = run(), observed = run(() => {});
    expect(observed).toEqual(plain);
  });
  it("swallows observer throws and attempted snapshot mutation without changing a real proposal or source input", () => {
    const plain = run(), thrown = run(fact => { (fact.from as {x:number}).x = 99999; throw Error("untrusted diagnostic sink"); });
    expect(thrown).toEqual(plain); expect(thrown.state.world.x).toBe(100);
  });
});
