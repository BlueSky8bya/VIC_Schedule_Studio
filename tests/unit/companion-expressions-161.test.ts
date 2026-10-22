import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { COMPANION_EXPRESSIONS, COMPANION_EXPRESSION_MS, companionMealExpression, createCompanionExpressions, sampleCompanionExpression, type CompanionExpressionContext } from "@/lib/ui/viewer-companion/expressions";
import anchors from "@/lib/ui/viewer-companion/expression-anchors-161.json";
import physicalMouths from "@/lib/ui/viewer-companion/mouth-anchors.json";
const base: CompanionExpressionContext = { token: "real-action:1", status: "idle", phase: 0, personality: "balanced", atHome: false, energy: .9, petting: false, busy: false, userNear: false, toyPlaying: false, toyApproach: false, lookingOut: false, reading: false, watching: false, music: false, season: 10, weather: "clear", daylight: true, outing: false };
describe("source-bound finite facial expressions161", () => {
  it("has36 distinct animated profiles, never enlarges an eye, and recovers exactly", () => {
    const signatures = new Set<string>();
    for (const [id] of COMPANION_EXPRESSIONS) {
      const samples = Array.from({ length: 41 }, (_, n) => sampleCompanionExpression(id, n / 40));
      for (const s of samples) { expect(Object.values(s).every(Number.isFinite)).toBe(true); expect(s.left).toBeGreaterThanOrEqual(0); expect(s.right).toBeGreaterThanOrEqual(0); expect(Math.max(s.left, s.right)).toBeLessThanOrEqual(1); expect(s.weight).toBeGreaterThanOrEqual(0); expect(s.weight).toBeLessThanOrEqual(1); }
      expect(samples[0]).toEqual(samples[40]); expect(sampleCompanionExpression(id, .5, true)).toEqual(samples[0]);
      signatures.add(JSON.stringify(samples));
    }
    expect(signatures.size).toBe(36);
  });
  it("binds each calibrated landmark to actual unchanged source bytes", () => {
    for (const source of anchors.sources) expect(createHash("sha256").update(readFileSync("public" + source.src)).digest("hex")).toBe(source.sha256);
    expect(anchors.frames.length).toBeGreaterThan(500); expect(anchors.frames.every(p => p.eyes.length === 2 && Math.abs(p.roll) <= 30 && ["front", "quarter"].includes(p.orientation))).toBe(true);
  });
  it("keeps each existing physical bite anchor at the same facial mouth center", () => {
    for (const mouth of physicalMouths.frames) {
      const frame = anchors.frames.find(f => f.physicalIndex === mouth.index)!;
      expect(frame.mouth?.x).toBeCloseTo(mouth.x / physicalMouths.cell * 80, 8);
      expect(frame.mouth?.y).toBeCloseTo(mouth.y / physicalMouths.cell * 80, 8);
    }
  });
  it("covers actual meal categories without assigning unusual retching to ordinary food", () => {
    expect(companionMealExpression("lemon")).toBe("sour"); expect(companionMealExpression("frozen-leftover-pizza")).toBe("icy"); expect(companionMealExpression("kimchi-stew")).toBe("spicy"); expect(companionMealExpression("birthday-seaweed-soup")).toBe("hot"); expect(companionMealExpression("apple")).toBe("savor");
  });
  it("uses real receipts once, gives direct petting priority and never freezes the brain", () => {
    const actor = createCompanionExpressions(), meal = { serial: 1, food: "lemon", full: false, last: true };
    expect(actor.sample({ ...base, meal }, 1)?.id).toBe("sour");
    expect(actor.sample({ ...base, meal }, COMPANION_EXPRESSION_MS + 2)?.id).toBe("last-bite");
    expect(actor.sample({ ...base, meal }, COMPANION_EXPRESSION_MS * 2 + 3)).toBeNull();
    expect(actor.sample({ ...base, meal }, 30000)).toBeNull();
    expect(actor.sample({ ...base, meal, petting: true }, 30001)?.id).toBe("shy");
    expect(actor.sample({ ...base, meal, petting: true }, 32000)?.id).toBe("melt");
  });
  it("consumes quiet-time receipts without replay on resume and bounds ambient repetition", () => {
    const actor = createCompanionExpressions(), meal = { serial: 1, food: "apple", full: true, last: true };
    expect(actor.sample({ ...base, meal }, 1, true)).toBeNull(); expect(actor.sample({ ...base, meal }, 10000)).toBeNull();
    const sniff = { ...base, status: "sniff", food: "apple" };
    expect(actor.sample(sniff, 10001)?.id).toBe("scent");
    expect(actor.sample(sniff, 12000)).toBeNull(); expect(actor.sample(sniff, 50000)).toBeNull();
  });
  it("routes contextual faces to current objects/environment rather than a timer-only carousel", () => {
    const cases: Array<[Partial<CompanionExpressionContext>, string]> = [
      [{ foodRefused: true }, "polite-no"], [{ status: "eat", phase: .1 }, "first-bite"], [{ status: "wake" }, "awake"], [{ status: "yawn" }, "sleepy"],
      [{ status: "sniff" }, "search"], [{ toyApproach: true }, "play-ready"], [{ toyPlaying: true }, "treasure"], [{ watching: true, phase: .8, personality: "performer" }, "giggle"],
      [{ reading: true, toyPlaying: true }, "reading"], [{ watching: true }, "tv"], [{ music: true }, "listen"], [{ lookingOut: true }, "sunny"],
      [{ lookingOut: true, weather: "rain" }, "rain"], [{ lookingOut: true, season: 4 }, "sneeze"], [{ season: 7 }, "warm"], [{ outing: true, status: "walk" }, "resolve"],
      [{ mishap: true, userNear: true, personality: "mischievous" }, "innocent"], [{ mishap: true, userNear: true }, "sorry"], [{ play: "bonk-sad" }, "unimpressed"],
      [{ play: "slip-tumble", phase: .1 }, "oops"], [{ play: "recover" }, "relief"], [{ userNear: true, status: "look" }, "greeting"], [{ cleanupReceipt: 1 }, "tidy-pride"],
    ];
    for (const [patch, id] of cases) expect(createCompanionExpressions().sample({ ...base, ...patch }, 10)?.id).toBe(id);
    const cold = createCompanionExpressions(); cold.sample({ ...base, season: 1 }, 1); expect(cold.sample({ ...base, season: 1, atHome: true }, 2)?.id).toBe("cold");
    const busy = createCompanionExpressions(); expect(busy.sample({ ...base, petting: true, busy: true }, 1)?.id).toBe("busy");
  });
  it("recognizes real sad poses and excludes obsolete play labels and travelling pose remnants", () => {
    for (const pose of [18, 19]) expect(createCompanionExpressions().sample({ ...base, pose }, 10)?.id).toBe("unimpressed");
    for (const patch of [{ play: "sulk" }, { play: "wiggle" }, { status: "walk", pose: 18 }])
      expect(createCompanionExpressions().sample({ ...base, ...patch }, 10)).toBeNull();
  });
});
