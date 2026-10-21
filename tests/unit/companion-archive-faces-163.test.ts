import { describe, expect, it } from "vitest";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_TOY_KINDS } from "@/lib/ui/viewer-companion/toy-catalog";
import { COMPANION_FOOD_IMPRESSIONS, COMPANION_TOY_IMPRESSIONS } from "@/lib/ui/viewer-companion/taste-descriptions";
import { companionItemTasteDescription } from "@/lib/ui/viewer-companion/taste-reasons";
import { companionTasteReason, createCompanionTastesStore, normalizeCompanionTastes } from "@/lib/ui/viewer-companion/toy-tastes";
import { COMPANION_EXPRESSIONS, COMPANION_EYE_SHAPE as E, sampleCompanionExpression } from "@/lib/ui/viewer-companion/expressions";

describe("163 specimen-specific impressions and readable expressions", () => {
  it("covers all252 foods and84 toys without a family fallback or missing polarity", () => {
    expect(Object.keys(COMPANION_FOOD_IMPRESSIONS).sort()).toEqual([...COMPANION_FOOD_KINDS].sort());
    expect(Object.keys(COMPANION_TOY_IMPRESSIONS).sort()).toEqual([...COMPANION_TOY_KINDS].sort());
    for (const [domain, kinds] of [["food", COMPANION_FOOD_KINDS], ["toy", COMPANION_TOY_KINDS]] as const) {
      const positive = new Set<string>(), negative = new Set<string>();
      for (const kind of kinds) { const a = companionItemTasteDescription(domain, kind, true)!, b = companionItemTasteDescription(domain, kind, false)!; expect(a.length).toBeGreaterThan(10); expect(b.length).toBeGreaterThan(10); expect(a).not.toBe(b); positive.add(a); negative.add(b); }
      expect(positive.size).toBe(kinds.length); expect(negative.size).toBe(kinds.length);
    }
  });
  it("repairs legacy raw turnip and frozen-food wording without erasing memories or writing storage on read", () => {
    let raw = JSON.stringify({ version: 1, reasons: [{ domain: "food", kind: "turnip", reason: "mild-bite", age: 2 }], foodTastes: { turnip: { score: .6, accepted: 2, declined: 0 } } });
    const before = raw, store = createCompanionTastesStore({ getItem: () => raw, setItem: (_key, value) => { raw = value; } });
    expect(companionTasteReason(store.load(), "food", "turnip", "positive")).toContain("알싸한"); expect(raw).toBe(before);
    expect(companionItemTasteDescription("food", "frozen-leftover-pizza", true)).toContain("차가운");
    expect(companionItemTasteDescription("food", "frozen-leftover-pizza", true)).not.toContain("따뜻");
    expect(companionItemTasteDescription("food", "herb-avocado-milk", false)).toContain("가쓰오부시");
    expect(companionItemTasteDescription("food", "cricket-pepero", false)).toContain("귀뚜라미");
    const memory = normalizeCompanionTastes({ version: 1, toys: ["toy-car"], reasons: [{ domain: "toy", kind: "toy-car", reason: "toy-fun", age: 1 }] });
    expect(companionTasteReason(memory, "toy", "toy-car", "positive")).toContain("바퀴"); expect(companionTasteReason(memory, "toy", "toy-car", "negative")).toBeUndefined();
  });
  it("uses deliberately closed shapes instead of turning every eye into a slit, while preserving open-eye bounds", () => {
    const shapes = new Set<number>();
    for (const [id] of COMPANION_EXPRESSIONS) for (let n = 0; n <= 60; n++) {
      const f = sampleCompanionExpression(id, n / 60); expect(Math.min(f.left, f.right)).toBeGreaterThanOrEqual(.55); expect(Math.max(f.left, f.right)).toBeLessThanOrEqual(1); shapes.add(f.leftShape); shapes.add(f.rightShape);
    }
    expect(shapes.size).toBe(7);
    expect(sampleCompanionExpression("melt", .55).leftShape).toBe(E.smile);
    expect(sampleCompanionExpression("sour", .55).leftShape).toBe(E.squeeze);
    expect(sampleCompanionExpression("reading", .55).leftShape).toBe(E.focus);
    expect(sampleCompanionExpression("sorry", .55).leftShape).toBe(E.worry);
    // Positive anticipation keeps the pupil open with a gently softened lid.
    expect(sampleCompanionExpression("first-bite", .55).leftShape).toBe(E.soft);
    expect(sampleCompanionExpression("unimpressed", .55).leftShape).toBe(E.flat);
  });
});
