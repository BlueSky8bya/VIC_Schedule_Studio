import { describe, expect, it } from "vitest";
import { createBrain, reachablePlatforms, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionHomeSteps, isCompanionHomeStep, planCompanionHomeReturn } from "@/lib/ui/viewer-companion/home-route";
import { safeCompanionSurfaces } from "@/lib/ui/viewer-companion/geometry";
import { DEFAULT_COMPANION_PREFERENCES as prefs } from "@/lib/ui/viewer-companion/preferences";
import { companionHabitSummary } from "@/lib/ui/viewer-companion/habit-summary";

const floor: Platform = { id: "viewport-floor", kind: "floor", x: 50, width: 1000, y: 1020 };
const seat: Platform = { id: "companion-home", kind: "date", x: 60, width: 120, y: 580 };
const roomFloor: Platform = { id: "companion-home-floor", kind: "floor", manualOnly: true, x: 60, width: 120, y: 630 };
const room = { left: 10, right: 300, top: 450, bottom: 650 };
const obstacles = [room];
const steps = createCompanionHomeSteps(room, 120, floor.y, 92, source => safeCompanionSurfaces(source, obstacles, 92, { width: 1100, height: 1100 }, { width: 70, height: 70 }));
const world: CompanionWorld = { x: 850, y: floor.y, platformId: floor.id, platforms: [floor, seat, roomFloor, ...steps], width: 1100, height: 1100 };

describe("shared finite home return", () => {
  it("walks and takes proved short jumps out of an empty month's bottom floor", () => {
    let point = { ...world }, jumps = 0, walks = 0, arrived = false;
    for (let i = 0; i < 30; i++) {
      const result = planCompanionHomeReturn(createBrain(), point, prefs);
      expect(["travel", "arrived"]).toContain(result.state);
      if (result.state !== "travel") { arrived = result.state === "arrived"; break; }
      const action = result.action;
      if (action.kind === "jump") {
        jumps++;
        expect(reachablePlatforms(point, [{ id: "exact-landing", kind: "date", x: action.target.x - 12, y: action.target.y, width: 24 }])).toHaveLength(1);
        expect(point.y - action.target.y).toBeLessThanOrEqual(140);
      } else { walks++; expect(Math.abs(action.target.x - point.x)).toBeLessThanOrEqual(180); }
      point = { ...point, ...action.target };
    }
    expect(arrived).toBe(true); expect(jumps).toBeGreaterThanOrEqual(3); expect(walks).toBeGreaterThan(0);
    expect(point.platformId).toBe(seat.id);
    expect(roomFloor.manualOnly).toBe(true);
  });
  it("prefers real ledges and shows no assistance when a natural route exists", () => {
    const ledges: Platform[] = [900, 780, 660].map((y, i) => ({ id: `ledge-${i}`, x: 90, y, width: 160, kind: "card" }));
    const result = planCompanionHomeReturn(createBrain(), { ...world, platforms: [...world.platforms, ...ledges] }, prefs);
    expect(result.state).toBe("travel"); expect(result.steps).toEqual([]);
  });
  it("does not invent a long flight when jumps are off, the home folds, or a support disappears", () => {
    expect(planCompanionHomeReturn(createBrain(), world, { ...prefs, jump: false }).state).toBe("blocked");
    expect(planCompanionHomeReturn(createBrain(), { ...world, platforms: [floor] }, prefs).state).toBe("missing");
    expect(planCompanionHomeReturn(createBrain(), { ...world, platforms: [floor, seat] }, prefs).state).toBe("blocked");
    expect(planCompanionHomeReturn(createBrain(), world, { ...prefs, enabled: false }).state).toBe("blocked");
    expect(planCompanionHomeReturn(createBrain(), { ...world, paused: true }, prefs).state).toBe("blocked");
    const same = { ...world, ...seat, x: 80, platformId: seat.id };
    expect(planCompanionHomeReturn(createBrain(), same, { ...prefs, jump: false, roam: false }).state).toBe("travel");
  });
  it("replans with moved geometry, never old screen coordinates", () => {
    const moved = { ...world, x: world.x - 5, y: world.y - 30, platforms: world.platforms.map(p => ({ ...p, x: p.x - 5, y: p.y - 30 })) };
    const result = planCompanionHomeReturn(createBrain(), moved, prefs);
    expect(result.state).toBe("travel");
    if (result.state === "travel") expect(result.action.target.y).toBe(floor.y - 30);
  });
  it("bounds assistance and rejects ink/control overlaps and invalid geometry", () => {
    expect(steps.length).toBeGreaterThan(0); expect(steps.every(p => isCompanionHomeStep(p.id))).toBe(true);
    expect(createCompanionHomeSteps(room, 120, 100000, 92, source => [source]).length).toBeLessThanOrEqual(24);
    expect(createCompanionHomeSteps(room, 120, floor.y, 92, () => [])).toEqual([]);
    expect(createCompanionHomeSteps({ ...room, bottom: NaN }, 120, floor.y, 92, source => [source])).toEqual([]);
    for (const p of steps) expect(p.y - 70).toBeGreaterThan(room.bottom);
  });
  it("keeps occupied, room and home nodes in a dense bounded graph", () => {
    const distant: Platform[] = Array.from({ length: 198 }, (_, i) => ({ id: `far-${i}`, x: 5000, y: 200, width: 100, kind: "date" }));
    const result = planCompanionHomeReturn(createBrain(), { ...world, platforms: [floor, ...distant, seat, roomFloor, ...steps] }, prefs);
    expect(result.state).toBe("travel"); expect(result.steps.length).toBeGreaterThan(0);
  });
});

describe("learned habit descriptions", () => {
  it("distinguishes fresh/reset memory from actual learned tendencies", () => {
    expect(companionHabitSummary(undefined)).toContain("아직 뚜렷하게");
    expect(companionHabitSummary({ sociability: .1, playfulness: .01, confidence: .05 })).toContain("아직 뚜렷하게");
    const summary = companionHabitSummary({ sociability: .5, playfulness: .4, confidence: .8 });
    expect(summary).toContain("손길"); expect(summary).toContain("장난과 탐험"); expect(summary).toContain("씩씩하게");
  });
  it("explains quiet/cautious tendencies without blame or fabricated history", () => {
    const summary = companionHabitSummary({ sociability: -.5, playfulness: -.5, confidence: -.8 });
    expect(summary).toContain("혼자 노는"); expect(summary).toContain("천천히"); expect(summary).toContain("살펴보고");
    expect(companionHabitSummary({ sociability: NaN, playfulness: Infinity, confidence: "bad" })).toContain("아직 뚜렷하게");
  });
});
