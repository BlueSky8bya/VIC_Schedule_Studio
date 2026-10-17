import { describe, expect, it } from "vitest";
import { createBrain, reachablePlatforms, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { canParkCompanionHomeWait, companionHomeBlockedResponse, planCompanionHomeReturn, shortestCompanionHomeRoute } from "@/lib/ui/viewer-companion/home-route";
import { DEFAULT_COMPANION_PREFERENCES as prefs } from "@/lib/ui/viewer-companion/preferences";
import { companionHabitDescriptions, companionHabitSummary } from "@/lib/ui/viewer-companion/habit-summary";

const floor: Platform = { id: "viewport-floor", kind: "floor", x: 50, width: 1000, y: 1020 };
const seat: Platform = { id: "companion-home", kind: "date", x: 60, width: 120, y: 580 };
const roomFloor: Platform = { id: "companion-home-floor", kind: "floor", manualOnly: true, x: 60, width: 120, y: 630 };
const world: CompanionWorld = { x: 850, y: floor.y, platformId: floor.id, platforms: [floor, seat, roomFloor], width: 1100, height: 1100 };

describe("shared direct home return", () => {
  it("confirms a disconnected route once, then yields only an automatic idea", () => {
    const isolated: Platform = { id: "isolated", kind: "card", x: 800, width: 60, y: 240 };
    const disconnected = { ...world, x: 830, y: 240, platformId: isolated.id, platforms: [isolated, seat, roomFloor] };
    expect(planCompanionHomeReturn(createBrain(), disconnected, prefs).state).toBe("blocked");
    for (const journey of ["automatic", "called"] as const) {
      expect(companionHomeBlockedResponse(journey, false)).toBe("revalidate");
      expect(planCompanionHomeReturn(createBrain(), disconnected, prefs).state).toBe("blocked");
      expect(companionHomeBlockedResponse(journey, true)).toBe(journey === "automatic" ? "resume" : "wait");
    }
  });
  it("lets a kept command yield to each finite affection, contact and motion lease", () => {
    expect(canParkCompanionHomeWait(1000, 1650, 1120, false)).toBe(false);
    expect(canParkCompanionHomeWait(1120, 1650, 1120, false)).toBe(false);
    expect(canParkCompanionHomeWait(1649.99, 1650, 1120, false)).toBe(false);
    expect(canParkCompanionHomeWait(1650, 1650, 1120, false)).toBe(true);
    expect(canParkCompanionHomeWait(2000, 1650, 2120, false)).toBe(false);
    expect(canParkCompanionHomeWait(2120, 1650, 2120, true)).toBe(false);
    expect(canParkCompanionHomeWait(2120, 1650, 2120, false)).toBe(true);
    expect(companionHomeBlockedResponse("called", true)).toBe("wait");
    for (const values of [[NaN, 0, 0], [0, Infinity, 0], [0, 0, Infinity]]) expect(canParkCompanionHomeWait(values[0], values[1], values[2], false)).toBe(false);
  });
  it("walks near the real house, then springs to its floor without any invented supports", () => {
    let point = { ...world }, jumps = 0, springs = 0, walks = 0, arrived = false;
    for (let i = 0; i < 30; i++) {
      const result = planCompanionHomeReturn(createBrain(), point, prefs);
      expect(["travel", "arrived"]).toContain(result.state);
      if (result.state !== "travel") { arrived = result.state === "arrived"; break; }
      const action = result.action;
      expect(world.platforms.some(p => p.id === action.target.platformId)).toBe(true);
      if (action.kind === "jump") {
        jumps++;
        const height = action.jumpHeight ?? 140;
        expect(reachablePlatforms(point, [{ id: "exact-landing", kind: "date", x: action.target.x - 12, y: action.target.y, width: 24 }], { maxRise: height })).toHaveLength(1);
        if (height > 140) {
          springs++;
          expect(action.target.platformId).toBe(roomFloor.id);
          expect(Math.abs(action.target.x - point.x)).toBeLessThanOrEqual(120);
          expect(point.y - height).toBeGreaterThanOrEqual(100);
        }
      } else { walks++; expect(action.target.platformId).toBe(point.platformId); }
      point = { ...point, ...action.target };
    }
    expect(arrived).toBe(true); expect(springs).toBe(1); expect(jumps).toBeLessThanOrEqual(3); expect(walks).toBe(1);
    expect(point.platformId).toBe(seat.id); expect(roomFloor.manualOnly).toBe(true);
  });
  it("uses ordinary nearby ledges without a high spring when a real route exists", () => {
    const ledges: Platform[] = [900, 780, 660].map((y, i) => ({ id: `ledge-${i}`, x: 90, y, width: 160, kind: "card" }));
    let point = { ...world, platforms: [...world.platforms, ...ledges] }, arrived = false;
    for (let i = 0; i < 30; i++) {
      const result = planCompanionHomeReturn(createBrain(), point, prefs);
      if (result.state !== "travel") { arrived = result.state === "arrived"; break; }
      expect(result.action.jumpHeight).toBeUndefined();
      point = { ...point, ...result.action.target };
    }
    expect(arrived).toBe(true);
  });
  it("crosses an uninterrupted real span in one action with a distinct species gait", () => {
    const plans = (["dog", "default", "cat"] as const).map(animalMode => {
      const result = planCompanionHomeReturn({ ...createBrain(), energy: .08 }, world, { ...prefs, animalMode, personality: "sleepy" });
      expect(result.state).toBe("travel");
      if (result.state !== "travel") throw new Error("Measured home route must be available");
      expect(result.action.kind).toBe("walk");
      expect(result.action.target.platformId).toBe(floor.id);
      expect(Math.abs(result.action.target.x - world.x)).toBeGreaterThan(180);
      expect(result.action.pace).toBe(animalMode === "dog" ? "scoot" : "amble");
      return result.action;
    });
    expect(plans[0].duration).toBeLessThan(plans[1].duration);
    expect(plans[1].duration).toBeLessThan(plans[2].duration);
    expect(plans.every(plan => plan.target.x === plans[0].target.x && Number.isFinite(plan.duration) && plan.duration > 0)).toBe(true);
  });
  it("crosses real floor fragments before the house spring instead of failing on the far fragment", () => {
    const left: Platform = { id: "viewport-floor", kind: "floor", x: 50, width: 800, y: 1020 };
    const right: Platform = { id: "viewport-floor-1", kind: "floor", x: 1070, width: 700, y: 1020 };
    let point: CompanionWorld = { ...world, width: 1920, x: 1500, platformId: right.id, platforms: [left, right, seat, roomFloor] };
    let crossed = false, arrived = false;
    for (let i = 0; i < 35; i++) {
      const result = planCompanionHomeReturn(createBrain(), point, prefs);
      if (result.state !== "travel") { arrived = result.state === "arrived"; break; }
      if (result.action.kind === "jump" && result.action.target.platformId === left.id) crossed = true;
      if ((result.action.jumpHeight ?? 0) > 140) expect(crossed).toBe(true);
      point = { ...point, ...result.action.target };
    }
    expect(crossed).toBe(true); expect(arrived).toBe(true);
  });
  it("compares total distance rather than always walking to a distant one-hop bridge", () => {
    const start: Platform = { id: "start", kind: "floor", x: 0, width: 900, y: 700 };
    const home: Platform = { id: "companion-home", kind: "date", x: 0, width: 900, y: 470 };
    const far: Platform = { id: "far", kind: "date", x: 800, width: 80, y: 580 };
    const near: Platform[] = [620, 540].map((y, i) => ({ id: `near-${i}`, kind: "card", x: 70, width: 100, y }));
    const point = { x: 110, y: start.y, platformId: start.id }, target = { x: 110, y: home.y, platformId: home.id };
    const route = shortestCompanionHomeRoute(point, target, [start, far, ...near, home], true)!;
    expect(route).not.toBeNull(); expect(route.some(s => s.target.platformId === far.id)).toBe(false);
    expect(route[0].kind).toBe("jump"); expect(route.some(s => s.target.platformId.startsWith("near-"))).toBe(true);
    expect(route.reduce((distance, step, i) => {
      const from = i ? route[i - 1].target : point;
      return distance + Math.hypot(step.target.x - from.x, step.target.y - from.y);
    }, 0)).toBeLessThan(400);
  });
  it("jumps directly to nearby home instead of detouring through the room floor", () => {
    const perch: Platform = { id: "near-home", kind: "card", x: 130, width: 80, y: 690 };
    const point = { ...world, x: 155, y: perch.y, platformId: perch.id, platforms: [...world.platforms, perch] };
    const result = planCompanionHomeReturn(createBrain(), point, prefs);
    expect(result.state).toBe("travel");
    if (result.state === "travel") { expect(result.action.kind).toBe("jump"); expect(result.action.target.platformId).toBe(seat.id); expect(result.action.jumpHeight).toBeUndefined(); }
  });
  it("can leave a deliberately occupied card top without walking across it or treating other manual tops as destinations", () => {
    const top: Platform = { id: "card-top", kind: "card", manualOnly: true, x: 90, width: 200, y: 690 };
    const route = shortestCompanionHomeRoute({ x: 155, y: top.y, platformId: top.id }, { x: 120, y: seat.y, platformId: seat.id }, [top, seat], true)!;
    expect(route[0].kind).toBe("jump"); expect(route[0].target.platformId).toBe(seat.id);
    expect(shortestCompanionHomeRoute({ x: 120, y: seat.y, platformId: seat.id }, { x: 155, y: top.y, platformId: top.id }, [top, seat], true)).toBeNull();
  });
  it("respects disabled/paused/jump switches and never invents missing geometry", () => {
    expect(planCompanionHomeReturn(createBrain(), world, { ...prefs, jump: false }).state).toBe("blocked");
    expect(planCompanionHomeReturn(createBrain(), { ...world, platforms: [floor] }, prefs).state).toBe("missing");
    expect(planCompanionHomeReturn(createBrain(), world, { ...prefs, enabled: false }).state).toBe("blocked");
    expect(planCompanionHomeReturn(createBrain(), { ...world, paused: true }, prefs).state).toBe("blocked");
    expect(planCompanionHomeReturn(createBrain(), { ...world, y: NaN }, prefs).state).toBe("blocked");
    const same = { ...world, x: 80, y: seat.y, platformId: seat.id };
    expect(planCompanionHomeReturn(createBrain(), same, { ...prefs, jump: false, roam: false }).state).toBe("travel");
  });
  it("replans moved geometry and bounds the spring at the viewport ceiling", () => {
    const moved = { ...world, x: world.x - 5, y: world.y - 30, platforms: world.platforms.map(p => ({ ...p, x: p.x - 5, y: p.y - 30 })) };
    const result = planCompanionHomeReturn(createBrain(), moved, prefs);
    expect(result.state).toBe("travel");
    if (result.state === "travel") expect(result.action.target.y).toBe(floor.y - 30);
    expect(planCompanionHomeReturn(createBrain(), { ...world, platforms: [floor, { ...seat, y: 90 }] }, prefs).state).toBe("blocked");
  });
  it("preserves occupied/home nodes in a dense bounded graph without adding steps", () => {
    const distant: Platform[] = Array.from({ length: 198 }, (_, i) => ({ id: `far-${i}`, x: 5000, y: 200, width: 100, kind: "date" }));
    const result = planCompanionHomeReturn(createBrain(), { ...world, platforms: [floor, ...distant, seat, roomFloor] }, prefs);
    expect(result.state).toBe("travel");
    if (result.state === "travel") expect(result.action.target.platformId).toBe(floor.id);
  });
});

describe("learned habit descriptions", () => {
  it("distinguishes fresh/reset memory from actual learned tendencies", () => {
    expect(companionHabitSummary(undefined)).toContain("아직 뚜렷한 습관");
    expect(companionHabitSummary({ sociability: .1, playfulness: .01, confidence: .05 })).toContain("아직 뚜렷한 습관");
    const summary = companionHabitSummary({ sociability: .5, playfulness: .4, confidence: .8 });
    expect(summary).toContain("쓰다듬기"); expect(summary).toContain("장난치고 탐험하기"); expect(summary).toContain("씩씩하게");
  });
  it("explains quiet/cautious tendencies without blame or fabricated history", () => {
    const summary = companionHabitSummary({ sociability: -.5, playfulness: -.5, confidence: -.8 });
    expect(summary).toContain("혼자 노는"); expect(summary).toContain("쉬엄쉬엄"); expect(summary).toContain("살피고 천천히");
    expect(companionHabitSummary({ sociability: NaN, playfulness: Infinity, confidence: "bad" })).toContain("아직 뚜렷한 습관");
  });
  it("presents only earned tendencies in stable labeled rows, with no invented neutral scores", () => {
    expect(companionHabitDescriptions(undefined)).toEqual([]);
    const rows = companionHabitDescriptions({ sociability: .5, playfulness: -.5, confidence: .05 });
    expect(rows).toEqual([
      { key: "sociability", label: "교감", description: "쓰다듬기와 곁에 있기" },
      { key: "playfulness", label: "놀이", description: "느긋하게 쉬엄쉬엄" },
    ]);
    expect(companionHabitSummary({ sociability: .5, playfulness: -.5, confidence: .05 })).toBe(rows.map(item => item.description).join(" · "));
  });
});
