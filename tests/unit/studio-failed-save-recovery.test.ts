import { describe, expect, it } from "vitest";
import { canRecoverSaveSnapshot, FailedSaveRecovery } from "@/lib/studio/failed-save-recovery";
import { createEmptyForm, DRAFT_TTL_MS } from "@/lib/studio/editor-model";

const allow = () => true;
const entry = (session: number, title: string, targetId = `temp-${session}`, id?: string) => ({
  session, targetId, dateKey: "2026-10-22", originalScope: "public" as const, form: { ...createEmptyForm(), id, publicTitle: title, tagIds: ["tag-a"], primaryTagIds: ["tag-a"] }
});
describe("failed save inputs stay independent in session memory", () => {
  it("copies submitted fields and tag arrays before later edits; failure never mutates the editor", () => {
    const store = new FailedSaveRecovery(), input = entry(1, "first");
    const attempt = store.begin(input, 100); input.form.publicTitle = "later"; input.form.tagIds.push("tag-b");
    store.fail(attempt, 200);
    const restored = store.take(attempt, 201, allow)!;
    expect(restored.form.publicTitle).toBe("first"); expect(restored.form.tagIds).toEqual(["tag-a"]);
    expect(restored.form.id).toBeUndefined(); expect(input.form.publicTitle).toBe("later");
  });
  it("keeps separate A/B new submissions on the same date, even with equal text", () => {
    const store = new FailedSaveRecovery(), a = store.begin(entry(1, "same"), 100), b = store.begin(entry(2, "same"), 101);
    store.fail(b, 200); store.fail(a, 201);
    expect(store.available(202, allow).map(x => x.attempt)).toEqual([a, b]);
    store.take(b, 203, allow); expect(store.take(a, 204, allow)?.form.publicTitle).toBe("same");
  });
  it("success cleans only its own attempt and never erases another failed snapshot", () => {
    const store = new FailedSaveRecovery(), a = store.begin(entry(1, "failed"), 100), b = store.begin(entry(2, "success"), 101);
    store.fail(a, 102); store.succeed(b); store.fail(b, 103);
    expect(store.available(104, allow).map(x => x.attempt)).toEqual([a]);
  });
  it("explicit discard cancels late replies only for that editor session", () => {
    const store = new FailedSaveRecovery(), a = store.begin(entry(1, "discarded"), 100), b = store.begin(entry(2, "other"), 101);
    store.discardSession(1, 102); store.fail(a, 103); store.fail(b, 104);
    expect(store.available(105, allow).map(x => x.form.publicTitle)).toEqual(["other"]);
  });
  it("retains a newer unsaved temp edit independently and deduplicates its later failed submission", () => {
    const store = new FailedSaveRecovery(), original = entry(1, "original"), newer = entry(2, "newer", original.targetId);
    const a = store.begin(original, 100), b = store.begin(newer, 101);
    store.fail(a, 103, { draft: { form: { ...newer.form, id: original.targetId }, ts: 102 }, session: 2, revision: store.markEdit() });
    store.fail(b, 104);
    const items = store.available(105, allow);
    expect(items.map(x => x.form.publicTitle)).toEqual(["original", "newer"]);
    expect(items.every(x => x.form.id === undefined)).toBe(true);
  });
  it("does not resurrect a newer temp edit explicitly discarded while create was pending", () => {
    const store = new FailedSaveRecovery(), a = store.begin(entry(1, "submitted"), 100);
    const revision = store.markEdit(); store.discardSession(2, 101);
    store.fail(a, 103, { draft: { form: entry(2, "discarded").form, ts: 102 }, session: 2, revision });
    expect(store.available(104, allow).map(x => x.form.publicTitle)).toEqual(["submitted"]);
  });
  it("allows fresh input and a new submission in the same editor after explicit discard", () => {
    const store = new FailedSaveRecovery(), a = store.begin(entry(1, "old"), 100);
    store.discardSession(1, 101);
    const b = store.begin(entry(1, "fresh"), 102);
    store.fail(a, 103); store.fail(b, 104);
    expect(store.available(105, allow).map(x => x.form.publicTitle)).toEqual(["fresh"]);
  });
  it("uses monotonic draft revision to distinguish fresh temp input after a discard", () => {
    const store = new FailedSaveRecovery(), a = store.begin(entry(1, "original"), 100);
    store.markEdit(); store.discardSession(2, 100);
    const revision = store.markEdit();
    store.fail(a, 100, { draft: { form: entry(2, "fresh").form, ts: 100 }, session: 2, revision });
    expect(store.available(100, allow).map(x => x.form.publicTitle)).toEqual(["original", "fresh"]);
  });
  it("drops a discarded submission but independently preserves its later temp editor input", () => {
    const store = new FailedSaveRecovery(), a = store.begin(entry(1, "discarded"), 100);
    store.discardSession(1, 101);
    store.fail(a, 103, { draft: { form: entry(2, "fresh").form, ts: 102 }, session: 2, revision: store.markEdit() });
    expect(store.available(104, allow).map(x => x.form.publicTitle)).toEqual(["fresh"]);
  });
  it("restores existing edits to their real ID, including temp-to-real promotion before failure", () => {
    const store = new FailedSaveRecovery(), a = store.begin(entry(1, "update", "temp-a"), 100);
    store.fail(a, 101, undefined, "real-id"); expect(store.take(a, 102, allow)?.form.id).toBe("real-id");
    const b = store.begin(entry(2, "existing", "real-b", "real-b"), 103);
    store.fail(b, 104); expect(store.take(b, 105, allow)?.form.id).toBe("real-b");
  });
  it("enforces the original ten-minute TTL for queued and still-pending attempts", () => {
    const store = new FailedSaveRecovery(), a = store.begin(entry(1, "expired"), 100), b = store.begin(entry(2, "pending"), 100);
    store.fail(a, 101); expect(store.available(100 + DRAFT_TTL_MS - 1, allow)).toHaveLength(1);
    expect(store.available(100 + DRAFT_TTL_MS, allow)).toEqual([]); store.fail(b, 101 + DRAFT_TTL_MS);
    expect(store.available(102 + DRAFT_TTL_MS, allow)).toEqual([]);
  });
  it("does not consume a private entry when current permissions reject recovery", () => {
    const store = new FailedSaveRecovery(), input = entry(1, "private"); input.form.visibilityScope = "owner_private";
    const a = store.begin(input, 100); store.fail(a, 101);
    expect(store.available(102, form => form.visibilityScope === "public")).toEqual([]);
    expect(store.take(a, 103, () => false)).toBeNull(); expect(store.take(a, 104, allow)?.form.publicTitle).toBe("private");
  });
  it("checks original and current target scopes, missing targets, unlock, owner and read-only independently", () => {
    const store = new FailedSaveRecovery(), a = store.begin(entry(1, "public input", "real-a", "real-a"), 100);
    store.fail(a, 101); const item = store.available(102, allow)[0];
    const access = { canEdit: true, unlocked: false, owner: true, readOnly: false };
    expect(canRecoverSaveSnapshot(item, access)).toBe(false);
    expect(canRecoverSaveSnapshot(item, access, { visibilityScope: "public" })).toBe(true);
    expect(canRecoverSaveSnapshot(item, access, { visibilityScope: "owner_private" })).toBe(false);
    expect(canRecoverSaveSnapshot({ ...item, originalScope: "owner_private" }, access, { visibilityScope: "public" })).toBe(false);
    expect(canRecoverSaveSnapshot({ ...item, originalScope: "owner_private" }, { ...access, unlocked: true, owner: false }, { visibilityScope: "public" })).toBe(false);
    expect(canRecoverSaveSnapshot({ ...item, originalScope: "owner_private" }, { ...access, unlocked: true }, { visibilityScope: "public" })).toBe(true);
    expect(canRecoverSaveSnapshot(item, { ...access, unlocked: true }, { visibilityScope: "unknown" })).toBe(false);
    expect(canRecoverSaveSnapshot(item, { ...access, readOnly: true }, { visibilityScope: "public" })).toBe(false);
    expect(canRecoverSaveSnapshot(item, { ...access, canEdit: false }, { visibilityScope: "public" })).toBe(false);
  });
  it("reaches three original failures before newly preserved drafts can repeat", () => {
    const store = new FailedSaveRecovery();
    for (let session = 1; session <= 3; session++) { const id = store.begin(entry(session, String(session)), 100); store.fail(id, 100); }
    const visited: string[] = []; let previous: ReturnType<typeof entry> | undefined;
    for (let step = 0; step < 3; step++) {
      const next = store.available(101, allow)[0], item = store.take(next.attempt, 101, allow)!;
      if (previous) { const id = store.begin({ ...previous, targetId: `draft-${step}` }, 101); store.fail(id, 101); }
      visited.push(item.form.publicTitle); previous = entry(step + 10, item.form.publicTitle);
    }
    expect(visited).toEqual(["1", "2", "3"]);
  });
});
