import { describe, expect, it, vi } from "vitest";
import { COMPANION_TASTES_MAX_BYTES, createCompanionTastesStore, normalizeCompanionTastes } from "@/lib/ui/viewer-companion/toy-tastes";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_TOY_KINDS } from "@/lib/ui/viewer-companion/toy-catalog";
import { COMPANION_TASTE_REASON_TEXT, evaluateCompanionFoodTaste, isCompanionFoodTasteOutcome, isCompanionToyTasteReason } from "@/lib/ui/viewer-companion/taste-reasons";

const longestReasons = () => {
  const candidates: { domain: "food" | "toy"; kind: string; reason: string; age: number }[] = [];
  for (const kind of COMPANION_FOOD_KINDS) for (const reason of Object.keys(COMPANION_TASTE_REASON_TEXT)) if (isCompanionFoodTasteOutcome({ food: kind, reaction: "liked", reason }) || isCompanionFoodTasteOutcome({ food: kind, reaction: "disliked", reason })) candidates.push({ domain: "food", kind, reason, age: 239 });
  for (const kind of COMPANION_TOY_KINDS) for (const reason of Object.keys(COMPANION_TASTE_REASON_TEXT)) if (isCompanionToyTasteReason(kind, reason)) candidates.push({ domain: "toy", kind, reason, age: 239 });
  const unique = new Set<string>();
  return candidates.sort((a, b) => JSON.stringify(b).length - JSON.stringify(a).length).filter(x => { const key = `${x.domain}:${x.kind}`; if (unique.has(key)) return false; unique.add(key); return true; }).slice(0, 8);
};
const record = { score: -.9999, accepted: 31, declined: 31, tripped: 31, freeText: "private-canary" };
const maximum = normalizeCompanionTastes({ version: 1, toys: COMPANION_TOY_KINDS, seen: COMPANION_TOY_KINDS, toyTastes: Object.fromEntries(COMPANION_TOY_KINDS.map(kind => [kind, record])), foodTastes: Object.fromEntries(COMPANION_FOOD_KINDS.map(kind => [kind, record])), reasons: longestReasons() });
const maximumRaw = JSON.stringify(maximum), maximumBytes = Buffer.byteLength(maximumRaw, "utf8");
const restore = (raw: string) => createCompanionTastesStore({ getItem: () => raw, setItem: vi.fn() }).load();

describe("143 bounded taste storage capacity", () => {
  it(`retains all336 maximized records, both84-item lists and8 longest valid reasons (${maximumBytes} UTF-8 bytes)`, () => {
    expect(COMPANION_TASTES_MAX_BYTES).toBe(32768);
    expect(COMPANION_FOOD_KINDS.length + COMPANION_TOY_KINDS.length).toBe(336);
    expect(maximumBytes).toBeGreaterThan(16384); expect(maximumBytes).toBeLessThanOrEqual(COMPANION_TASTES_MAX_BYTES);
    expect(Object.keys(maximum.foodTastes)).toHaveLength(252); expect(Object.keys(maximum.toyTastes)).toHaveLength(84); expect(maximum.toys).toHaveLength(84); expect(maximum.seen).toHaveLength(84); expect(maximum.reasons).toHaveLength(8);
    expect(maximumRaw).not.toContain("private-canary"); expect(restore(maximumRaw)).toEqual(maximum);
  });
  it("accepts the exact byte boundary and fails closed on one extra byte of otherwise valid JSON", () => {
    const shell = { version: 1, toys: ["ball"], seen: ["ball"], padding: "" }, overhead = Buffer.byteLength(JSON.stringify(shell), "utf8");
    const accepted = JSON.stringify({ ...shell, padding: "x".repeat(COMPANION_TASTES_MAX_BYTES - overhead) });
    expect(Buffer.byteLength(accepted, "utf8")).toBe(COMPANION_TASTES_MAX_BYTES); expect(restore(accepted).toys).toEqual(["ball"]);
    const rejected = JSON.stringify({ ...shell, padding: "x".repeat(COMPANION_TASTES_MAX_BYTES - overhead + 1) });
    expect(Buffer.byteLength(rejected, "utf8")).toBe(COMPANION_TASTES_MAX_BYTES + 1); expect(restore(rejected).toys).toEqual([]);
  });
  it("enforces UTF-8 bytes even when a multibyte JSON string has fewer than32768 code units", () => {
    const raw = JSON.stringify({ version: 1, toys: ["ball"], padding: "가".repeat(12000) });
    expect(raw.length).toBeLessThan(COMPANION_TASTES_MAX_BYTES); expect(Buffer.byteLength(raw, "utf8")).toBeGreaterThan(COMPANION_TASTES_MAX_BYTES);
    expect(restore(raw).toys).toEqual([]);
    for (const malformed of ["{", "null", '{"version":999,"toys":["ball"]}', "x".repeat(COMPANION_TASTES_MAX_BYTES + 1)]) expect(restore(malformed).toys).toEqual([]);
  });
  it("keeps established discoveries, acknowledgments and scores without writing during legacy load", () => {
    const old = normalizeCompanionTastes({ version: 1, toys: ["ball", "feather"], seen: ["ball"], toyTastes: { feather: { score: .7, accepted: 3, declined: 0 } }, foodTastes: { durian: { score: -.4, accepted: 1, declined: 3 } } });
    const write = vi.fn(), store = createCompanionTastesStore({ getItem: () => JSON.stringify(old), setItem: write }); expect(store.load()).toEqual(old); expect(write).not.toHaveBeenCalled();
  });
  it("reloads all336 actual completed food/play records without clearing earlier entries as the JSON grows", () => {
    let raw: string | null = null; const writes: number[] = [];
    const disk = { getItem: () => raw, setItem: (_key: string, next: string) => { raw = next; writes.push(Buffer.byteLength(next, "utf8")); } }, store = createCompanionTastesStore(disk);
    for (const kind of COMPANION_TOY_KINDS) { expect(store.recordToy(kind, "played")).toBe(true); expect(store.acknowledge(kind)).toBe(true); }
    for (const kind of COMPANION_FOOD_KINDS) expect(store.recordFoodOutcome(evaluateCompanionFoodTaste(kind, undefined, .82))).toBe(true);
    const complete = store.load(); expect(complete.toys).toHaveLength(84); expect(complete.seen).toHaveLength(84); expect(Object.keys(complete.toyTastes)).toHaveLength(84); expect(Object.keys(complete.foodTastes)).toHaveLength(252); expect(complete.reasons).toHaveLength(8);
    expect(Math.max(...writes)).toBeLessThanOrEqual(COMPANION_TASTES_MAX_BYTES); expect(createCompanionTastesStore(disk).load()).toEqual(complete);
  });
});
