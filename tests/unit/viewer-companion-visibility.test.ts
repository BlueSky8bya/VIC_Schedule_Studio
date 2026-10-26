import { describe, expect, it } from "vitest";
import { COMPANION_VISIBILITY_KEY as KEY, COMPANION_VISIBILITY_MAX_BYTES, COMPANION_VISIBILITY_TTL_MS as TTL, createCompanionVisibilityJournal, safeCompanionVisibilityFacts } from "@/lib/ui/viewer-companion/visibility-diagnostics";
import { createCompanionVisibilityRecovery, recoverCompanionVisibilityFloor } from "@/lib/ui/viewer-companion/visibility-recovery";
import type { Platform } from "@/lib/ui/viewer-companion/brain";

const revision = "a".repeat(40), oldRevision = "b".repeat(40);
const incident = { stage: "observed", reason: "offscreen", x: -83.76, y: 780, hidden: true } as const;
function storage(initial?: string) {
  const values = new Map<string, string>([["unrelated", "KEEP"]]);
  if (initial !== undefined) values.set(KEY, initial);
  const touched: string[] = [];
  return { values, touched, getItem(key: string) { touched.push(key); return values.get(key) ?? null; }, setItem(key: string, value: string) { touched.push(key); values.set(key, value); }, removeItem(key: string) { touched.push(key); values.delete(key); } };
}
describe("local companion visibility evidence", () => {
  it("projects a fixed allowlist without copying IDs, titles, identity, URL, errors or arbitrary strings", () => {
    expect(safeCompanionVisibilityFacts({ ...incident, eventId: "SECRET-ID", title: "SECRET-TITLE", body: "SECRET-BODY", email: "PRIVATE-EMAIL", url: "PRIVATE-URL", error: "RAW-ERROR", support: "card-SECRET", action: "SECRET-ACTION", width: Infinity, height: NaN, size: 100001, y: 783.2, awaiting: "true", side: "left" }))
      .toEqual({ stage: "observed", reason: "offscreen", x: -84, y: 784, hidden: true, side: "left" });
  });
  it("records semantic transitions once, keeps the originating revision after reload and no other storage key", () => {
    let time = 1000; const port = storage(), first = createCompanionVisibilityJournal(port, oldRevision, () => time);
    first.record(incident); first.record(incident);
    expect(first.snapshot().records).toHaveLength(1);
    time += 100; const next = createCompanionVisibilityJournal(port, revision, () => time); next.record({ stage: "recovered", reason: "visible" });
    expect(next.snapshot().records.map(entry => entry.revision)).toEqual([oldRevision, revision]);
    expect(port.values.get("unrelated")).toBe("KEEP"); expect(new Set(port.touched)).toEqual(new Set([KEY]));
  });
  it("bounds records and serialized bytes, and expires observations on read/export", () => {
    let time = 1000; const port = storage(), journal = createCompanionVisibilityJournal(port, revision, () => time);
    for (let i = 0; i < 80; i++) { time++; journal.record({ ...incident, x: i * 4 }); }
    expect(journal.snapshot().records).toHaveLength(24);
    expect(port.values.get(KEY)!.length * 2).toBeLessThanOrEqual(COMPANION_VISIBILITY_MAX_BYTES);
    time += TTL; expect(journal.snapshot().records).toEqual([]); expect(port.values.has(KEY)).toBe(false);
  });
  it.each([["bad-json", "broken-json"], ["unknown-schema", JSON.stringify({ schemaVersion: 99, records: [incident] })], ["oversized", "x".repeat(COMPANION_VISIBILITY_MAX_BYTES)]])("discards malformed or oversized own storage safely: %s", (_label, value) => {
    const port = storage(value), journal = createCompanionVisibilityJournal(port, revision, () => 1000);
    expect(journal.snapshot().records).toEqual([]); expect(port.values.has(KEY)).toBe(false); expect(port.values.get("unrelated")).toBe("KEEP");
  });
  it("sanitizes persisted records, drops expired/future observations and does not revive an unknown schema", () => {
    const time = TTL + 5000, raw = JSON.stringify({ schemaVersion: 1, kind: "local-companion-visibility", revision: "PRIVATE", records: [
      { ...incident, at: time, revision: oldRevision, title: "SECRET", platform: "SECRET-ID" }, { ...incident, at: time + 1 }, { ...incident, at: time - TTL },
    ] });
    const port = storage(raw), result = createCompanionVisibilityJournal(port, revision, () => time).snapshot();
    expect(result.records).toHaveLength(1); expect(result.records[0].revision).toBe(oldRevision); expect(JSON.stringify(result)).not.toMatch(/PRIVATE|SECRET/);
  });
  it("persists the next incident after repairing malformed JSON, including across reload", () => {
    const port = storage("{broken");
    createCompanionVisibilityJournal(port, revision, () => 1000).record(incident);
    expect(createCompanionVisibilityJournal(port, revision, () => 1100).snapshot().records).toHaveLength(1);
  });
  it("retains a distinct recurrence with the same facts after a new controller mounts", () => {
    let time = 1000; const port = storage();
    createCompanionVisibilityJournal(port, revision, () => time).record(incident);
    time = 2000; const next = createCompanionVisibilityJournal(port, revision, () => time); next.record(incident); next.record(incident);
    expect(next.snapshot().records.map(entry => entry.at)).toEqual([1000, 2000]);
  });
  it("survives unavailable and full storage with memory evidence", () => {
    const denied = { getItem() { throw Error("DENIED"); }, setItem() { throw Error("FULL"); }, removeItem() { throw Error("DENIED"); } };
    const journal = createCompanionVisibilityJournal(denied, revision, () => 1000);
    expect(() => journal.record(incident)).not.toThrow(); expect(journal.snapshot().records[0].reason).toBe("offscreen");
    const full = createCompanionVisibilityJournal({ getItem: () => null, setItem() { throw Error("FULL"); }, removeItem() {} }, revision, () => 1000);
    full.record(incident); expect(full.snapshot().records).toHaveLength(1);
  });
});

describe("finite missing-companion recovery policy", () => {
  const fault = { now: 0, reason: "bounds" as const, eligible: true, hasFreshGeometry: false, hasSafeFloor: true };
  it("requires sustained evidence AND a fresh safe geometry delivery, then grants one attempt only", () => {
    const policy = createCompanionVisibilityRecovery();
    expect(policy.observe(fault)).toBe("arm");
    expect(policy.observe({ ...fault, now: 1199, hasFreshGeometry: true })).toBe("none");
    expect(policy.observe({ ...fault, now: 1200 })).toBe("none");
    expect(policy.observe({ ...fault, now: 1200, hasFreshGeometry: true })).toBe("recover");
    expect(policy.observe({ ...fault, now: 90000, hasFreshGeometry: true })).toBe("none");
  });
  it("waits without polling when no safe floor exists and uses a later real delivery", () => {
    const policy = createCompanionVisibilityRecovery(); policy.observe(fault);
    expect(policy.observe({ ...fault, now: 1300, hasFreshGeometry: true, hasSafeFloor: false })).toBe("unavailable");
    expect(policy.observe({ ...fault, now: 3000, hasFreshGeometry: true, hasSafeFloor: false })).toBe("none");
    expect(policy.observe({ ...fault, now: 5000, hasFreshGeometry: true })).toBe("recover");
  });
  it("cancels on user/hidden/presentation ownership and a visible state; no stale permission survives", () => {
    for (const excluded of [{ eligible: false }, { reason: null }]) {
      const policy = createCompanionVisibilityRecovery(); policy.observe(fault);
      expect(policy.observe({ ...fault, now: 1100, ...excluded })).toBe("cancel");
      expect(policy.observe({ ...fault, now: 1300, hasFreshGeometry: true })).toBe("arm");
      expect(policy.observe({ ...fault, now: 1400, hasFreshGeometry: true })).toBe("none");
    }
  });
  it("preserves cooldown across new episodes and reset, and does not recover for an invalid clock", () => {
    const policy = createCompanionVisibilityRecovery(); policy.observe(fault); policy.observe({ ...fault, now: 1200, hasFreshGeometry: true });
    policy.reset(); expect(policy.observe({ ...fault, now: 2000 })).toBe("arm");
    expect(policy.observe({ ...fault, now: 3300, hasFreshGeometry: true })).toBe("unavailable");
    expect(policy.observe({ ...fault, now: 31200, hasFreshGeometry: true })).toBe("recover");
    expect(policy.observe({ ...fault, now: NaN, hasFreshGeometry: true })).toBe("cancel");
  });
  it("cannot weaken the minimum delay by configuration", () => {
    const policy = createCompanionVisibilityRecovery({ delayMs: 0 }); policy.observe(fault);
    expect(policy.observe({ ...fault, now: 1, hasFreshGeometry: true })).toBe("none");
  });
});

describe("measured emergency floor", () => {
  const context = { point: { x: -200, y: 500 }, viewport: { width: 1000, height: 800 }, size: 92 };
  const floor: Platform = { id: "viewport-floor", kind: "floor", x: 52, y: 782, width: 896 };
  it("chooses the closest actual safe floor fragment and clamps its centre interval", () => {
    expect(recoverCompanionVisibilityFloor(context, [floor])).toEqual({ platformId: floor.id, x: 52, y: 782 });
    expect(recoverCompanionVisibilityFloor({ ...context, point: { x: 999, y: 900 } }, [floor])).toEqual({ platformId: floor.id, x: 948, y: 782 });
  });
  it("rejects invented, unsafe, manual, control, home, card, zero, nonfinite and offscreen destinations", () => {
    const invalid: Platform[] = [
      { ...floor, id: "companion-home" }, { ...floor, id: "viewport-floor-food" }, { ...floor, kind: "card" }, { ...floor, manualOnly: true }, { ...floor, bodyOnly: true },
      { ...floor, x: 0 }, { ...floor, y: 799 }, { ...floor, y: 90 }, { ...floor, width: 0 }, { ...floor, width: Infinity }, { ...floor, x: 500, width: 900 },
    ];
    for (const candidate of invalid) expect(recoverCompanionVisibilityFloor(context, [candidate])).toBeUndefined();
    expect(recoverCompanionVisibilityFloor({ ...context, point: { x: NaN, y: 500 } }, [floor])).toBeUndefined();
    expect(recoverCompanionVisibilityFloor(context, [])).toBeUndefined();
  });
});
