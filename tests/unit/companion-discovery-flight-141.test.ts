import { describe, expect, it } from "vitest";
import { companionDiscoveryFlightPlan, createCompanionDiscoveryFlightGate, validCompanionDiscoveryNotice, type CompanionDiscoveryNotice } from "@/lib/ui/viewer-companion/discovery-flight";

describe("141 one committed discovery, one finite souvenir", () => {
  it("accepts only fixed earned-content kinds and finite source/serial values", () => {
    for (const content of [{ kind: "food", id: "apple" }, { kind: "toy", id: "ball" }, { kind: "behavior", id: "groom" }, { kind: "moment", id: "meal-finished" }] as const) {
      const notice = { ...content, serial: 1, source: { x: 90, y: 120 } };
      expect(validCompanionDiscoveryNotice(notice)).toBe(true);
      for (const invalid of [{ serial: 0 }, { serial: NaN }, { serial: Number.MAX_SAFE_INTEGER + 1 }, { source: { x: Infinity, y: 120 } }, { id: "private-canary" }]) expect(validCompanionDiscoveryNotice({ ...notice, ...invalid } as CompanionDiscoveryNotice)).toBe(false);
    }
  });
  it("arrives at the actual book centre with a smaller picture and finite fade", () => {
    const source = { x: 200, y: 180 }, book = { x: 480, y: 220 }, plan = companionDiscoveryFlightPlan(source, book, false)!;
    expect(plan.stationary).toBe(false); expect(plan.duration).toBeGreaterThan(0); expect(plan.duration).toBeLessThanOrEqual(1500);
    expect(plan.frames[0]).toMatchObject({ opacity: 0, transform: "translate3d(176px,156px,0) scale(1.3)" });
    expect(plan.frames.at(-1)).toMatchObject({ opacity: 0, transform: "translate3d(456px,196px,0) scale(0.45)" });
  });
  it("keeps reduced/OFF and missing-book cues stationary without inventing a target", () => {
    for (const [book, quiet] of [[{ x: 480, y: 220 }, true], [undefined, false]] as const) {
      const plan = companionDiscoveryFlightPlan({ x: 200, y: 180 }, book, quiet)!;
      expect(plan.stationary).toBe(true); expect(new Set(plan.frames.map(frame => frame.transform))).toEqual(new Set(["translate3d(176px,156px,0) scale(1)"]));
      expect(plan.duration).toBeLessThanOrEqual(600); expect(plan.frames.some(frame => frame.opacity === 1)).toBe(true);
    }
    expect(companionDiscoveryFlightPlan({ x: NaN, y: 1 }, undefined, false)).toBeUndefined();
    expect(companionDiscoveryFlightPlan({ x: 1, y: 1 }, { x: 3, y: Infinity }, false)).toBeUndefined();
  });
  it("does not replay duplicate/old serials or let a canceled completion clear the next discovery", () => {
    const gate = createCompanionDiscoveryFlightGate();
    for (const serial of [0, -1, Infinity, NaN, 1.5]) expect(gate.accept(serial)).toBe(false);
    expect(gate.accept(1)).toBe(true); expect(gate.accept(1)).toBe(false);
    expect(gate.accept(2)).toBe(true); expect(gate.finish(1)).toBe(false); expect(gate.current()).toBe(2);
    expect(gate.finish(2)).toBe(true); expect(gate.finish(2)).toBe(false);
    expect(gate.accept(1)).toBe(false); expect(gate.accept(2)).toBe(false); expect(gate.accept(3)).toBe(true);
  });
});
