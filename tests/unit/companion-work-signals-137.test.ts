import { afterEach, describe, expect, it, vi } from "vitest";
import { COMPANION_WORK_SIGNAL, createCompanionWorkCompletion, emitCompanionWorkSignal, validCompanionWorkSignal, type CompanionWorkSignalKind } from "@/lib/ui/viewer-companion/work-signals";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function browser() {
  const target = new EventTarget(), received: unknown[] = [], kinds: string[] = [];
  target.addEventListener(COMPANION_WORK_SIGNAL, event => received.push((event as CustomEvent).detail));
  const dispatchEvent = vi.fn((event: Event) => { kinds.push(event.type); return target.dispatchEvent(event); });
  vi.stubGlobal("window", { dispatchEvent });
  return { received, kinds, dispatchEvent };
}
const deferred = () => {
  let resolve: (value: boolean) => void = () => undefined;
  const promise = new Promise<boolean>(done => { resolve = done; });
  return { promise, resolve };
};

describe("137 public coarse work lifecycle", () => {
  it("validates exactly one own data field and rejects every sensitive or foreign payload", () => {
    for (const kind of ["opened", "closed", "saved", "undo", "redo"]) expect(validCompanionWorkSignal({ kind })).toBe(true);
    for (const value of [null, undefined, [], "saved", false, {}, { kind: "private" }, { kind: "saved", title: "private-canary" }, { kind: "saved", id: "sensitive-id" }, { kind: "saved", date: "2026-10-19" }, { kind: "saved", role: "owner" }, { kind: "saved", visibilityScope: "owner_private" }]) expect(validCompanionWorkSignal(value)).toBe(false);
    const nonenumerable = Object.defineProperty({ kind: "saved" }, "private", { value: "private-canary" });
    expect(validCompanionWorkSignal(nonenumerable)).toBe(false);
    expect(validCompanionWorkSignal({ kind: "saved", [Symbol("private")]: "private-canary" })).toBe(false);
    const getter = vi.fn(() => "saved");
    expect(validCompanionWorkSignal(Object.defineProperty({}, "kind", { get: getter }))).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });

  it("emits each fixed kind once with a frozen field-only detail and no network/activity/timer effects", () => {
    const proof = browser(), fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const timeout = vi.spyOn(globalThis, "setTimeout");
    const kinds: CompanionWorkSignalKind[] = ["opened", "closed", "saved", "undo", "redo"];
    for (const kind of kinds) expect(emitCompanionWorkSignal(kind)).toBe(true);
    expect(proof.received).toEqual(kinds.map(kind => ({ kind })));
    expect(proof.received.every(detail => Object.isFrozen(detail) && Reflect.ownKeys(detail as object).join() === "kind")).toBe(true);
    expect(proof.kinds).toEqual(kinds.map(() => COMPANION_WORK_SIGNAL));
    expect(fetch).not.toHaveBeenCalled(); expect(timeout).not.toHaveBeenCalled();
  });

  it("does not emit in SSR or for a runtime foreign kind", () => {
    expect(emitCompanionWorkSignal("saved")).toBe(false);
    const proof = browser(); expect(emitCompanionWorkSignal("private-canary" as CompanionWorkSignalKind)).toBe(false);
    expect(proof.received).toEqual([]);
  });

  it("waits for every successful server acknowledgement and deduplicates a history group", async () => {
    const proof = browser(), done = createCompanionWorkCompletion("undo", 2)!, a = deferred(), b = deferred();
    const first = a.promise.then(success => { if (success) done(); });
    const second = b.promise.then(success => { if (success) done(); });
    expect(proof.received).toEqual([]);
    a.resolve(true); await first; expect(proof.received).toEqual([]);
    b.resolve(true); await second; expect(proof.received).toEqual([{ kind: "undo" }]);
    done(); done(); expect(proof.received).toEqual([{ kind: "undo" }]);
  });

  it("never turns a partial group failure or no server operation into a successful history signal", async () => {
    const proof = browser(), done = createCompanionWorkCompletion("redo", 2)!, success = deferred(), failed = deferred();
    const first = success.promise.then(ok => { if (ok) done(); });
    const second = failed.promise.then(ok => { if (ok) done(); });
    success.resolve(true); failed.resolve(false); await Promise.all([first, second]);
    expect(proof.received).toEqual([]);
    // The studio counts zero for private/teaser/mixed groups; rejected or
    // nonexistent work has no completion callback to accidentally invoke.
    for (const count of [0, -1, .5, Number.NaN, Infinity]) expect(createCompanionWorkCompletion("redo", count)).toBeUndefined();
    expect(proof.received).toEqual([]);
  });
});
