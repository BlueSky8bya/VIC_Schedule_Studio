import { afterEach, describe, expect, it, vi } from "vitest";
import { COMPANION_SHOWCASE_EVENT, companionShowcaseFootprint, companionShowcaseLayoutMutation, createCompanionShowcaseSession, exposedCompanionShowcaseRect } from "@/lib/ui/viewer-companion/showcase-session";

const viewport = { width: 1440, height: 1000 };
const calendar = { left: 400, right: 1420, top: 100, bottom: 960 };
const home = { left: 20, right: 320, top: 220, bottom: 650 };
function node(rect: { left: number; right: number; top: number; bottom: number }, hidden = false) {
  return { isConnected: true, hidden, parentElement: null, closest: () => hidden ? {} : null, getBoundingClientRect: () => ({ ...rect, width: rect.right - rect.left, height: rect.bottom - rect.top }) } as unknown as HTMLElement;
}
function fixture() {
  const events = new EventTarget(), frames: (() => void)[] = [];
  vi.stubGlobal("window", events); vi.stubGlobal("innerWidth", viewport.width); vi.stubGlobal("innerHeight", viewport.height);
  vi.stubGlobal("document", { querySelectorAll: () => [node(calendar), node(home)] });
  vi.stubGlobal("getComputedStyle", () => ({ display: "block", visibility: "visible", opacity: "1" }));
  vi.stubGlobal("requestAnimationFrame", (callback: () => void) => { frames.push(callback); return frames.length; }); vi.stubGlobal("cancelAnimationFrame", () => {});
  const session = createCompanionShowcaseSession(); session.attach();
  const emit = (active: boolean, phase: "before" | "after") => events.dispatchEvent(new CustomEvent(COMPANION_SHOWCASE_EVENT, { detail: { active, phase } }));
  return { session, emit, events, flush: () => { while (frames.length) for (const callback of frames.splice(0)) callback(); } };
}
afterEach(() => vi.unstubAllGlobals());

describe("same-object meadow admission and screen-session position", () => {
  it("only forwards acknowledged input to the one admitted real resident while appreciation is active", () => {
    const { session, emit } = fixture(), interact = vi.fn();
    session.register("pet", { kind: "pet", node: () => node({ left: 44, right: 136, top: 808, bottom: 900 }), point: () => ({ x: 90, y: 900 }), interact });
    session.interact("pet"); expect(interact).not.toHaveBeenCalled();
    emit(true, "before"); session.interact("pet"); expect(interact.mock.calls).toEqual([["pet"]]);
    const ownership = session.ownershipSnapshot(), revision = session.snapshot();
    session.move("pet", { x: 94, y: 900 }); expect(session.snapshot()).toBeGreaterThan(revision); expect(session.ownershipSnapshot()).toBe(ownership);
    Object.assign(document, { hidden: true }); session.interact("drag"); expect(interact).toHaveBeenCalledTimes(1);
    Object.assign(document, { hidden: false }); emit(false, "after"); session.interact("pet"); expect(interact).toHaveBeenCalledTimes(1);
    session.clear(); session.interact("pet"); expect(interact).toHaveBeenCalledTimes(1); session.dispose();
  });
  it("requires the entire visible footprint to clear calendar, room and viewport edges", () => {
    expect(exposedCompanionShowcaseRect(companionShowcaseFootprint({ x: 90, y: 900 }, { width: 92, height: 92 }), viewport, [calendar, home])).toBe(true);
    expect(exposedCompanionShowcaseRect(companionShowcaseFootprint({ x: 385, y: 900 }, { width: 44, height: 44 }), viewport, [calendar])).toBe(false);
    expect(exposedCompanionShowcaseRect(companionShowcaseFootprint({ x: 100, y: 500 }, { width: 44, height: 44 }), viewport, [home])).toBe(false);
    expect(exposedCompanionShowcaseRect(companionShowcaseFootprint({ x: 10, y: 900 }, { width: 44, height: 44 }), viewport, [])).toBe(false);
    expect(exposedCompanionShowcaseRect({ left: NaN, right: 1, top: 0, bottom: 1 }, viewport, [])).toBe(false);
  });

  it("admits only pre-existing exposed actors before the room and calendar disappear", () => {
    const { session, emit } = fixture();
    session.register("pet", { kind: "pet", node: () => node({ left: 44, right: 136, top: 808, bottom: 900 }), point: () => ({ x: 90, y: 900 }) });
    session.register("food:home", { kind: "food", node: () => node({ left: 90, right: 134, top: 490, bottom: 534 }), point: () => ({ x: 112, y: 528 }) });
    session.register("toy:calendar", { kind: "toy", node: () => node({ left: 600, right: 644, top: 490, bottom: 534 }), point: () => ({ x: 622, y: 534 }) });
    session.register("toy:hidden", { kind: "toy", node: () => node({ left: 90, right: 134, top: 800, bottom: 844 }, true), point: () => ({ x: 112, y: 844 }) });
    emit(true, "before");
    expect(session.has("pet")).toBe(true); expect(session.has("food:home")).toBe(false); expect(session.has("toy:calendar")).toBe(false); expect(session.has("toy:hidden")).toBe(false);
    session.dispose();
  });

  it("returns a covered pet home immediately and admits the home resident on the next departure", () => {
    const { session, emit, flush } = fixture();
    session.register("pet", { kind: "pet", node: () => node({ left: 80, right: 172, top: 400, bottom: 492 }), point: () => ({ x: 126, y: 492 }) });
    emit(true, "before"); expect(session.has("pet")).toBe(true);
    session.move("pet", { x: 650, y: 700 }); emit(false, "after");
    expect(session.has("pet")).toBe(false);
    expect(session.takeReturnedPet()).toEqual({ x: 650, y: 700, home: true });
    expect(session.takeReturnedPet()).toBeUndefined(); flush();
    emit(true, "before"); expect(session.point("pet")).toMatchObject({ x: 126, y: 492 });
    session.dispose();
  });

  it("keeps food and toy identity and foot offsets and retires only leased physical items on screen change", () => {
    const { session, emit, flush } = fixture();
    session.register("food:one", { kind: "food", node: () => node({ left: 68, right: 112, top: 862, bottom: 906 }), point: () => ({ x: 90, y: 900 }) });
    session.register("toy:one", { kind: "toy", node: () => node({ left: 168, right: 212, top: 856, bottom: 900 }), point: () => ({ x: 190, y: 900 }) });
    emit(true, "before"); session.move("food:one", { x: 650, y: 700 }); emit(false, "after");
    expect(session.visible("food:one")).toBe(false); expect(session.visible("toy:one")).toBe(true);
    expect(session.point("food:one")).toBeUndefined();
    const cleared: string[][] = []; session.subscribeClear(ids => cleared.push([...ids].sort())); flush();
    expect(cleared).toEqual([]); expect(session.has("food:one")).toBe(false);
    session.clear(); expect(cleared).toEqual([["toy:one"]]); expect(session.hasKind("food")).toBe(false); expect(session.hasKind("toy")).toBe(false);
    session.dispose(); expect(createCompanionShowcaseSession().hasKind("food")).toBe(false);
  });

  it("hands an airborne painted foot and scale back without replacing the outdoor input ground", () => {
    const { session, emit } = fixture();
    session.register("pet", { kind: "pet", node: () => node({ left: 44, right: 136, top: 808, bottom: 900 }), point: () => ({ x: 90, y: 900 }) });
    emit(true, "before"); session.move("pet", { x: 850, y: 700 });
    session.presentPet({ y: 560, scale: .88 });
    expect(session.point("pet")).toMatchObject({ x: 850, y: 700 });
    session.presentPet({ y: NaN, scale: 1 });
    emit(false, "after");
    expect(session.takeReturnedPet()).toEqual({ x: 850, y: 560, scale: .88, home: true });
    expect(session.takeReturnedPet()).toBeUndefined(); session.dispose();
  });

  it("retires same-mount bfcache leases on pagehide and persisted pageshow", () => {
    const { session, emit, events } = fixture();
    session.register("toy:one", { kind: "toy", node: () => node({ left: 168, right: 212, top: 856, bottom: 900 }), point: () => ({ x: 190, y: 900 }) });
    const retired: string[][] = []; session.subscribeClear(ids => retired.push([...ids]));
    emit(true, "before"); expect(session.has("toy:one")).toBe(true);
    events.dispatchEvent(new Event("pagehide")); expect(session.has("toy:one")).toBe(false); expect(session.active()).toBe(false);
    emit(true, "before"); const show = new Event("pageshow"); Object.defineProperty(show, "persisted", { value: true }); events.dispatchEvent(show);
    expect(session.has("toy:one")).toBe(false); expect(retired).toEqual([["toy:one"], ["toy:one"]]);
    session.dispose(); emit(true, "before"); events.dispatchEvent(show); expect(retired).toHaveLength(2);
  });

  it("permanently retires covered food and toys but keeps exposed physical identities", () => {
    const { session, emit, flush } = fixture();
    const retired: string[][] = []; session.subscribeClear(ids => retired.push([...ids].sort()));
    for (const [id, x] of [["food:covered", 90], ["toy:covered", 190], ["toy:exposed", 290]] as const) {
      session.register(id, { kind: id.startsWith("food") ? "food" : "toy", node: () => node({ left: x - 22, right: x + 22, top: 856, bottom: 900 }), point: () => ({ x, y: 900 }) });
    }
    emit(true, "before"); session.move("food:covered", { x: 650, y: 700 }); session.move("toy:covered", { x: 700, y: 700 });
    emit(false, "after"); flush();
    expect(retired).toEqual([["food:covered", "toy:covered"]]);
    expect(session.has("food:covered")).toBe(false); expect(session.has("toy:covered")).toBe(false);
    expect(session.point("toy:exposed")).toMatchObject({ x: 290, y: 900 });
    session.unregister("food:covered"); session.unregister("toy:covered");
    emit(true, "before"); expect(session.has("food:covered")).toBe(false); expect(session.has("toy:covered")).toBe(false);
    expect(session.has("toy:exposed")).toBe(true); session.dispose();
  });

  it("commits covered-item deletion before an immediate re-entry can cancel layout frames", () => {
    const { session, emit, flush } = fixture();
    session.register("toy:one", { kind: "toy", node: () => node({ left: 168, right: 212, top: 856, bottom: 900 }), point: () => ({ x: 190, y: 900 }) });
    const retired: string[] = [];
    session.subscribeClear(ids => { for (const id of ids) { retired.push(id); session.unregister(id); } });
    emit(true, "before"); session.move("toy:one", { x: 700, y: 700 });
    emit(false, "after"); emit(true, "before"); flush();
    expect(retired).toEqual(["toy:one"]); expect(session.has("toy:one")).toBe(false); session.dispose();
  });

  it("invalidates actual layout insertions/attributes while ignoring actor and procedural paint", () => {
    const element = (kind: "own" | "box" | "body") => {
      const value = { nodeType: 1, matches: (selector: string) => selector.includes(".vc-companion") ? kind === "own" : kind === "box", closest: (selector: string) => (selector.includes(".vc-companion") ? kind === "own" : kind === "box") ? value : null, querySelector: () => null };
      return value as unknown as Node;
    };
    const body = element("body"), box = element("box"), actor = element("own");
    const mutation = (type: MutationRecord["type"], target: Node, added: Node[] = [], removed: Node[] = []) => ({ type, target, addedNodes: added as unknown as NodeList, removedNodes: removed as unknown as NodeList });
    expect(companionShowcaseLayoutMutation(mutation("childList", body, [box]))).toBe(true);
    expect(companionShowcaseLayoutMutation(mutation("childList", body, [], [box]))).toBe(true);
    expect(companionShowcaseLayoutMutation(mutation("attributes", box))).toBe(true);
    expect(companionShowcaseLayoutMutation(mutation("attributes", actor))).toBe(false);
    expect(companionShowcaseLayoutMutation(mutation("childList", body, [actor]))).toBe(false);
    expect(companionShowcaseLayoutMutation(mutation("childList", actor, [box]))).toBe(false);
  });

  it("coalesces a newly inserted or closed cover without observing actor styles or polling forever", () => {
    const { session, emit, flush } = fixture(); session.dispose();
    let changed: ((records: MutationRecord[]) => void) | undefined, options: MutationObserverInit | undefined, disconnected = false;
    vi.stubGlobal("MutationObserver", class {
      constructor(callback: MutationCallback) { changed = records => callback(records, this as unknown as MutationObserver); }
      observe(_node: Node, value: MutationObserverInit) { options = value; }
      disconnect() { disconnected = true; }
    });
    const body = { nodeType: 1, matches: () => false, closest: () => null } as unknown as HTMLElement;
    Object.assign(document, { body });
    let added = false;
    Object.assign(document, { querySelectorAll: () => [node(calendar), node(home), ...(added ? [node({ left: 60, right: 260, top: 800, bottom: 940 })] : [])] });
    session.attach();
    session.register("toy:one", { kind: "toy", node: () => node({ left: 168, right: 212, top: 856, bottom: 900 }), point: () => ({ x: 190, y: 900 }) });
    emit(true, "before"); emit(false, "after"); flush(); expect(session.visible("toy:one")).toBe(true);
    const cover = { nodeType: 1, matches: (selector: string) => !selector.includes(".vc-companion"), closest: () => null, querySelector: () => null } as unknown as Node;
    const record = { type: "childList", target: body, addedNodes: [cover], removedNodes: [] } as unknown as MutationRecord;
    // The actual observer excludes style/data paint. Its pure classifier also
    // excludes native actor layers, and two layout records share one frame.
    expect(options?.attributeFilter).not.toContain("style");
    added = true; const before = session.snapshot(); changed!([record]); changed!([record]); flush();
    expect(session.snapshot() - before).toBe(1); expect(session.visible("toy:one")).toBe(false);
    added = false; changed!([{ ...record, addedNodes: [], removedNodes: [cover] } as unknown as MutationRecord]); flush();
    expect(session.visible("toy:one")).toBe(true); const stable = session.snapshot(); flush(); expect(session.snapshot()).toBe(stable);
    session.dispose(); expect(disconnected).toBe(true);
  });
});
