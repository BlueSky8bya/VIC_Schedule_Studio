import { describe, expect, it } from "vitest";
import { createCompanionAgentExperience } from "../../lib/ui/viewer-companion/agent-experience";
import { COMPANION_AGENT_EXPERIENCE_KEY, createCompanionAgentExperienceStore, reconcileCompanionAgentExperienceGeneration, sameCompanionAgentGeneration } from "../../lib/ui/viewer-companion/agent-experience-store";
import { createCompanionCareStore } from "../../lib/ui/viewer-companion/care";

function fixture() {
  const values = new Map<string, string>(); let reads = 0, writes = 0;
  const storage = { getItem: (key: string) => { reads++; return values.get(key) ?? null; }, setItem: (key: string, value: string) => { writes++; values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  return { values, storage, counts: () => ({ reads, writes }) };
}
const choice = { personality: "tidy" as const, context: "home" as const, family: "cleanup" as const, learn: true };

describe("142 aggregate agent memory persistence", () => {
  it("persists actual learned scores across reload and keeps reset generations separate", () => {
    const f = fixture(), store = createCompanionAgentExperienceStore(f.storage), learner = createCompanionAgentExperience();
    learner.observe({ ...choice, effect: "toy-returned" });
    expect(store.save(learner.snapshot(), 3, true)).toBe(true);
    const reloaded = createCompanionAgentExperience(store.load(3, true));
    expect(reloaded.score(choice)).toBe(learner.score(choice));
    expect(store.load(4, true).entries).toEqual([]);
    store.clear(); expect(f.values.has(COMPANION_AGENT_EXPERIENCE_KEY)).toBe(false);
    expect(store.load(3, true).entries).toEqual([]);
  });
  it("does not read or write while learning is OFF and avoids unchanged flushes", () => {
    const f = fixture(), store = createCompanionAgentExperienceStore(f.storage);
    expect(store.load(0, false).entries).toEqual([]);
    expect(store.save({ v: 1, entries: [] }, 0, false)).toBe(false);
    expect(f.counts()).toEqual({ reads: 0, writes: 0 });
    expect(store.save({ v: 1, entries: [] }, 0, true)).toBe(true);
    expect(store.save({ v: 1, entries: [] }, 0, true)).toBe(false);
    expect(f.counts().writes).toBe(1);
  });
  it("strips untrusted extra fields and rejects oversized, malformed and stale envelopes", () => {
    const f = fixture(), store = createCompanionAgentExperienceStore(f.storage);
    store.save({ v: 1, schedule: "synthetic-sensitive-canary", entries: [{ ...choice, count: 3, mean: .7, itemId: "synthetic-item", body: "synthetic-sensitive-canary" }] }, 0, true);
    const raw = f.values.get(COMPANION_AGENT_EXPERIENCE_KEY)!;
    expect(raw).not.toContain("synthetic-sensitive-canary"); expect(raw).not.toContain("synthetic-item"); expect(raw).not.toContain("learn");
    f.values.set(COMPANION_AGENT_EXPERIENCE_KEY, "x".repeat(24_577)); expect(store.load(0, true).entries).toEqual([]);
    f.values.set(COMPANION_AGENT_EXPERIENCE_KEY, "{"); expect(store.load(0, true).entries).toEqual([]);
    f.values.set(COMPANION_AGENT_EXPERIENCE_KEY, JSON.stringify({ version: 2, generation: 0, policy: { v: 1, entries: [] } })); expect(store.load(0, true).entries).toEqual([]);
  });
  it("handles blocked storage and retries a failed write at the next explicit flush", () => {
    const f = fixture(); let blocked = true;
    const store = createCompanionAgentExperienceStore({ ...f.storage, setItem: (key, value) => { if (blocked) throw Error("blocked"); f.storage.setItem(key, value); } });
    expect(store.save({ v: 1, entries: [] }, 0, true)).toBe(false); blocked = false;
    expect(store.save({ v: 1, entries: [] }, 0, true)).toBe(true);
    expect(() => createCompanionAgentExperienceStore({ getItem: () => { throw Error("blocked"); }, setItem: () => { throw Error("blocked"); }, removeItem: () => { throw Error("blocked"); } }).clear()).not.toThrow();
  });
  it("uses browser storage-event bytes and a null clear even when reads are blocked", () => {
    const f = fixture(), store = createCompanionAgentExperienceStore(f.storage), learner = createCompanionAgentExperience();
    learner.observe({ ...choice, effect: "toy-returned" }); store.save(learner.snapshot(), 2, true);
    const blocked = createCompanionAgentExperienceStore({ ...f.storage, getItem: () => { throw Error("blocked"); } });
    expect(blocked.load(2, true).entries).toEqual([]);
    expect(blocked.synchronize(f.values.get(COMPANION_AGENT_EXPERIENCE_KEY)!, 2, true).entries).toEqual(learner.snapshot().entries);
    expect(blocked.synchronize(null, 2, true).entries).toEqual([]);
    expect(blocked.synchronize(f.values.get(COMPANION_AGENT_EXPERIENCE_KEY)!, 2, false).entries).toEqual([]);
  });
  it("erases old rewards when a real care flush discovers another tab's reset before its storage event", () => {
    const f = fixture(), store = createCompanionAgentExperienceStore(f.storage), learner = createCompanionAgentExperience();
    const notifications: number[] = [], care = createCompanionCareStore(f.storage, () => 0, () => 0, undefined, habits => notifications.push(habits.generation));
    const oldBrain = care.load(); let ownedGeneration = oldBrain.habits.generation;
    const oldActionGeneration = ownedGeneration;
    learner.observe({ ...choice, effect: "toy-returned" }); store.save(learner.snapshot(), ownedGeneration, true);

    // A second real store writes the reset. Its browser storage notification
    // has not reached this tab when an actual meal forces the next care save.
    const remote = createCompanionCareStore(f.storage, () => 0, () => 0);
    const resetBrain = remote.resetHabits();
    const saved = care.save({ ...oldBrain, hunger: .1 }, true);
    expect(saved.habits.generation).toBe(resetBrain.habits.generation);
    expect(saved.habits.generation).not.toBe(ownedGeneration);
    expect(notifications).toEqual([]); // Care discovered it without a reset callback.

    let resets = 0;
    const reset = () => { resets++; learner.clear(); store.clear(); };
    ownedGeneration = reconcileCompanionAgentExperienceGeneration(ownedGeneration, saved.habits.generation, reset);
    store.save(learner.snapshot(), ownedGeneration, true);
    expect(resets).toBe(1); expect(learner.snapshot().entries).toEqual([]);
    expect(store.load(resetBrain.habits.generation, true).entries).toEqual([]);
    expect(learner.observe({ ...choice, effect: "toy-returned", learn: sameCompanionAgentGeneration(oldActionGeneration, ownedGeneration) })).toBe(false);

    // The delayed same-generation event cannot rerun the reset, while a new
    // action's actual ACK may earn its own first reward in the new generation.
    reconcileCompanionAgentExperienceGeneration(ownedGeneration, saved.habits.generation, reset);
    expect(resets).toBe(1);
    expect(learner.observe({ ...choice, effect: "toy-returned", learn: sameCompanionAgentGeneration(ownedGeneration, saved.habits.generation) })).toBe(true);
    store.save(learner.snapshot(), ownedGeneration, true);
    expect(createCompanionAgentExperience(store.load(ownedGeneration, true)).snapshot().entries).toEqual([{ personality: "tidy", context: "home", family: "cleanup", count: 1, mean: 1 }]);
  });
  it("preserves current-generation rewards and unchanged explicit flush deduplication", () => {
    const f = fixture(), store = createCompanionAgentExperienceStore(f.storage), learner = createCompanionAgentExperience();
    learner.observe({ ...choice, effect: "toy-returned" }); store.save(learner.snapshot(), 3, true);
    const before = learner.snapshot(); let resets = 0;
    expect(reconcileCompanionAgentExperienceGeneration(3, 3, () => { resets++; learner.clear(); store.clear(); })).toBe(3);
    expect(resets).toBe(0); expect(learner.snapshot()).toEqual(before);
    expect(store.save(learner.snapshot(), 3, true)).toBe(false); expect(f.counts().writes).toBe(1);
  });
  it("still erases the old generation while learning is OFF without reading or writing memory", () => {
    const f = fixture(), store = createCompanionAgentExperienceStore(f.storage), learner = createCompanionAgentExperience();
    learner.observe({ ...choice, effect: "toy-returned" }); store.save(learner.snapshot(), 0, true);
    const before = f.counts();
    const generation = reconcileCompanionAgentExperienceGeneration(0, 1, () => { learner.clear(); store.clear(); });
    expect(store.save(learner.snapshot(), generation, false)).toBe(false);
    expect(store.load(generation, false).entries).toEqual([]); expect(learner.snapshot().entries).toEqual([]);
    expect(f.values.has(COMPANION_AGENT_EXPERIENCE_KEY)).toBe(false); expect(f.counts()).toEqual(before);
  });
  it.each([NaN, Infinity, -1, 1.5])("fails closed on invalid generation %s instead of preserving or saving old rewards", invalid => {
    const f = fixture(), store = createCompanionAgentExperienceStore(f.storage), learner = createCompanionAgentExperience();
    learner.observe({ ...choice, effect: "toy-returned" });
    const generation = reconcileCompanionAgentExperienceGeneration(0, invalid, () => { learner.clear(); store.clear(); });
    expect(Number.isNaN(generation)).toBe(true); expect(learner.snapshot().entries).toEqual([]);
    expect(sameCompanionAgentGeneration(invalid, invalid)).toBe(false);
    expect(store.save(learner.snapshot(), generation, true)).toBe(false); expect(f.counts()).toEqual({ reads: 0, writes: 0 });
  });
});
