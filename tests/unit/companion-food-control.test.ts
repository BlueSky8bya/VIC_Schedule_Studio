import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CompanionFoodControl } from "@/components/poster/viewer-companion/companion-food";
import type { CompanionGeometryAnchor } from "@/lib/ui/viewer-companion/geometry";
import type { Platform } from "@/lib/ui/viewer-companion/brain";

const harness = vi.hoisted(() => ({ states: [] as unknown[], state: 0, refs: [] as { current: unknown }[], ref: 0, effects: [] as (() => void | (() => void))[], layouts: [] as (() => void | (() => void))[], api: undefined as CompanionFoodControl | undefined, commits: 0, graphics: "full" as "full" | "off", activity: vi.fn(), discarded: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  forwardRef: (render: unknown) => render,
  useState: (initial: unknown) => {
    const index = harness.state++;
    if (!(index in harness.states)) harness.states[index] = initial;
    return [harness.states[index], (value: unknown) => { harness.states[index] = typeof value === "function" ? value(harness.states[index]) : value; harness.commits++; }];
  },
  useRef: (initial: unknown) => harness.refs[harness.ref++] ?? (harness.refs[harness.ref - 1] = { current: initial }),
  useCallback: (callback: unknown) => callback,
  useImperativeHandle: (_ref: unknown, create: () => CompanionFoodControl) => { harness.api = create(); },
  useEffect: (effect: () => void | (() => void)) => { harness.effects.push(effect); },
  useLayoutEffect: (effect: () => void | (() => void)) => { harness.layouts.push(effect); },
}));
vi.mock("@/lib/activity/client", () => ({ logActivity: harness.activity }));
vi.mock("@/lib/ui/gfx", () => ({ gfxMode: () => harness.graphics }));
vi.mock("@/components/poster/viewer-companion/companion-fruit", () => ({ CompanionFruit: () => null }));

type Element = ReactElement<Record<string, unknown>>;
type FakeNode = ReturnType<typeof node>;
let tree: ReactNode, clock = 0, frameSerial = 0, hidden = false, reduce = false;
let frames: Map<number, FrameRequestCallback>, nodeById: Map<string, FakeNode>, windowEvents: Map<string, () => void>, documentEvents: Map<string, () => void>;
const floor: Platform = { id: "viewport-floor-food", kind: "floor", x: 24, y: 770, width: 952 };
function node() {
  const attributes = new Map<string, string>(), properties = new Map<string, string>();
  return {
    attributes, hidden: false, isConnected: true, dataset: {} as Record<string, string>,
    style: { transform: "", setProperty: (key: string, value: string) => properties.set(key, value), removeProperty: (key: string) => properties.delete(key) },
    firstElementChild: { style: { transform: "" } },
    hasAttribute: (key: string) => attributes.has(key), setAttribute: (key: string, value: string) => attributes.set(key, value), removeAttribute: (key: string) => attributes.delete(key),
    toggleAttribute: (key: string, value: boolean) => value ? attributes.set(key, "") : attributes.delete(key), getAttribute: (key: string) => attributes.get(key) ?? null,
    matches: (selector: string) => selector === "[data-companion-trash]" && attributes.has("data-companion-trash"), closest: () => null,
    getBoundingClientRect: () => ({ left: 600, right: 644, top: 400, bottom: 444, width: 44, height: 44 }),
    focus: vi.fn(), setPointerCapture: vi.fn(), hasPointerCapture: () => false, releasePointerCapture: vi.fn(),
    animate: vi.fn(() => ({ cancel: vi.fn(), onfinish: null, oncancel: null })),
  };
}
function elements(value: ReactNode): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...elements(element.props.children as ReactNode)];
}
const api = () => harness.api!;
const tile = (id: string) => elements(tree).find(item => item.props["data-food"] === id)!;
async function render(enabled = true, blocked = false) {
  vi.stubGlobal("React", await import("react"));
  harness.state = 0; harness.ref = 0; harness.effects = []; harness.layouts = [];
  const { CompanionFood } = await import("@/components/poster/viewer-companion/companion-food");
  tree = (CompanionFood as unknown as (props: unknown, ref: unknown) => ReactNode)({ enabled, blocked, monthKey: "2026-10", returnFocus: vi.fn(), onDiscard: harness.discarded }, {});
  for (const item of elements(tree).filter(item => item.props["data-food"])) {
    const id = String(item.props["data-food"]), button = nodeById.get(id) ?? node(); button.dataset.food = id; nodeById.set(id, button);
    (item.props.ref as (node: unknown) => void)(button);
  }
  return tree;
}
async function spawn(x = 200, y = 300, autonomous = false) {
  const id = api().spawn("apple", { x, y }, undefined, autonomous)!;
  await render(); return id;
}
function frame(at: number) { clock = at; const due = [...frames.values()]; frames.clear(); for (const callback of due) callback(at); }
function event(id: string, extra: Record<string, unknown> = {}) {
  return { button: 0, pointerId: 1, clientX: 200, clientY: 284, currentTarget: nodeById.get(id), preventDefault: vi.fn(), stopPropagation: vi.fn(), ...extra };
}
function invoke(id: string, name: string, extra?: Record<string, unknown>) { (tile(id).props[name] as (event: unknown) => void)(event(id, extra)); }

beforeEach(async () => {
  harness.states = []; harness.refs = []; harness.commits = 0; harness.graphics = "full"; harness.activity.mockReset(); harness.discarded.mockReset();
  clock = 1000; frameSerial = 0; hidden = false; reduce = false; frames = new Map(); nodeById = new Map(); windowEvents = new Map(); documentEvents = new Map();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.stubGlobal("innerWidth", 1000); vi.stubGlobal("innerHeight", 800); vi.stubGlobal("scrollX", 0); vi.stubGlobal("scrollY", 0);
  vi.stubGlobal("performance", { now: () => clock });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frameSerial, callback); return frameSerial; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal("window", { scrollX: 0, scrollY: 0, addEventListener: (name: string, callback: () => void) => windowEvents.set(name, callback), removeEventListener: (name: string) => windowEvents.delete(name) });
  vi.stubGlobal("document", { get hidden() { return hidden; }, activeElement: null, documentElement: { hasAttribute: () => reduce }, elementsFromPoint: () => [], querySelector: () => null, querySelectorAll: () => [], addEventListener: (name: string, callback: () => void) => documentEvents.set(name, callback), removeEventListener: (name: string) => documentEvents.delete(name) });
  vi.stubGlobal("getComputedStyle", () => ({ visibility: "visible", opacity: "1" }));
  await render(); api().sync([floor]);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("actual food-controller carry and physical scatter callbacks", () => {
  it("uses a decorative aria-hidden outlet while still hiding snacks with its hidden room ancestor", async () => {
    let hiddenRoom = false;
    const source = node(); source.attributes.set("aria-hidden", "true");
    const outlet = Object.assign(source, {
      closest: (selector: string) => selector.includes("aria-hidden") ? source : null,
      parentElement: { closest: () => hiddenRoom ? source : null },
    });
    const id = api().spawn("apple", { x: 560, y: 420 }, outlet as unknown as HTMLElement)!;
    await render(); api().sync([floor]);
    expect(nodeById.get(id)!.hidden).toBe(false); expect(api().foods()[0].id).toBe(id);
    hiddenRoom = true; api().sync([floor]);
    expect(nodeById.get(id)!.hidden).toBe(true); expect(api().foods()).toHaveLength(0);
    hiddenRoom = false; api().sync([floor]);
    expect(nodeById.get(id)!.hidden).toBe(false); expect(api().foods()[0].id).toBe(id);
  });
  it("notifies each actually removed human Delete/clear food once without sending its id to activity", async () => {
    const first = await spawn(200), second = await spawn(280), third = await spawn(360);
    harness.activity.mockClear();
    invoke(first, "onKeyDown", { key: "Delete" }); invoke(first, "onKeyDown", { key: "Backspace" });
    expect(harness.discarded.mock.calls).toEqual([[first]]);
    api().clear(); api().clear();
    expect(harness.discarded.mock.calls).toEqual([[first], [second], [third]]);
    expect(harness.activity.mock.calls).toEqual([["ui.click", { target: "companion-food-discard" }], ["ui.click", { target: "companion-food-clear" }]]);
    expect(JSON.stringify(harness.activity.mock.calls)).not.toContain(first);
  });
  it("notifies native trash only after dwell and actual removal, never a cancelled gesture", async () => {
    const id = await spawn(), bin = node(); bin.attributes.set("data-companion-trash", "");
    vi.spyOn(document, "querySelectorAll").mockReturnValue([bin] as unknown as NodeListOf<HTMLElement>);
    invoke(id, "onPointerDown"); invoke(id, "onPointerMove", { clientX: 622, clientY: 420 }); frame(1017);
    invoke(id, "onPointerCancel"); frame(1500); vi.advanceTimersByTime(500);
    expect(harness.discarded).not.toHaveBeenCalled(); expect(api().contains(id)).toBe(true);
    invoke(id, "onPointerDown"); invoke(id, "onPointerMove", { clientX: 622, clientY: 420 }); frame(1517);
    invoke(id, "onPointerUp", { clientX: 622, clientY: 420 }); frame(1837);
    expect(harness.discarded).not.toHaveBeenCalled(); expect(api().contains(id)).toBe(true);
    vi.advanceTimersByTime(180);
    expect(harness.discarded.mock.calls).toEqual([[id]]); expect(api().contains(id)).toBe(false);
  });
  it("excludes consumption, pocket capture, autonomous trash and lifecycle clearing from human discard", async () => {
    const eaten = await spawn(); expect(api().consume(eaten)).toBe(true);
    const stashed = await spawn(); expect(api().stash(stashed)).toBe(true);
    const carried = await spawn(), bin = node(); bin.attributes.set("data-companion-trash", "");
    expect(api().beginCarry(carried)).toBe(true); api().carry(carried, { x: 622, y: 435 });
    expect(api().discardCarry(carried, bin as unknown as HTMLElement)).toBe(true); vi.advanceTimersByTime(180);
    await spawn(); harness.effects[0]();
    expect(api().foods()).toHaveLength(0); expect(harness.discarded).not.toHaveBeenCalled();
  });
  it("rejects invalid native card/day/panel snapshots before a delayed scan while retaining the true viewport floor", async () => {
    const stale: Platform[] = [{ id: "card-1-food-top", kind: "card", x: 100, y: 400, width: 500 }, { id: "date-2-floor-food", kind: "floor", x: 100, y: 450, width: 500 }, { id: "companion-panel-floor-food", kind: "floor", x: 100, y: 500, width: 500 }];
    api().sync([...stale, floor], () => undefined);
    const id = await spawn(300, 300);
    invoke(id, "onPointerDown", { clientX: 300, clientY: 284 });
    invoke(id, "onPointerMove", { clientX: 310, clientY: 300 }); frame(1017);
    invoke(id, "onPointerUp", { clientX: 310, clientY: 300 }); frame(3000);
    expect(api().foods()[0]).toMatchObject({ id, platformId: floor.id, y: floor.y });
    expect(nodeById.get(id)!.dataset.platform).toBe(floor.id);
    expect(api().foods().some(food => stale.some(support => support.id === food.platformId))).toBe(false);
  });
  const outlet = { x: 264.515625, y: 421.46875 }, recipient = { x: 172.25875, y: 430.65625 };
  const room: Platform = { id: "companion-home-floor-food", kind: "floor", x: 41, y: recipient.y, width: 179 };
  function roomSource() {
    const measured = vi.fn(() => ({ left: 19, top: 404.265625, width: 322, height: 32.390625 }));
    const source = { isConnected: true, closest: (selector: string) => selector === ".vc-home" ? { querySelectorAll: () => [] } : null, matches: (selector: string) => selector === ".vc-home-floor", getBoundingClientRect: measured };
    api().sync([room, floor], id => id === room.id ? { element: source, left: 19, top: 404.265625 } as unknown as CompanionGeometryAnchor : undefined);
    measured.mockClear(); return measured;
  }
  it("ejects a self-dispensed snack from the actual outlet to the measured accessible home floor on the existing finite drop clock", async () => {
    const measured = roomSource();
    const id = api().spawn("bread", outlet, undefined, true, recipient)!;
    expect(id).toEqual(expect.any(String)); expect(measured).toHaveBeenCalledTimes(1);
    await render(); harness.layouts[1]();
    expect(nodeById.get(id)!.style.transform).toBe("translate3d(264.516px,421.469px,0)");
    expect(api().foods()).toHaveLength(0); expect(api().consume(id)).toBe(false); expect(api().beginCarry(id)).toBe(false);
    frame(1150);
    expect(nodeById.get(id)!.style.transform).not.toContain("430.656px");
    frame(2600);
    const settled = api().foods()[0];
    expect(settled).toMatchObject({ id, kind: "bread", y: recipient.y, platformId: room.id });
    expect(Math.abs(settled.x - recipient.x)).toBeLessThanOrEqual(36);
    expect(frames.size).toBe(0); expect(harness.activity).not.toHaveBeenCalled();
  });
  it("rejects an unavailable ejection receiver before creating food, while ordinary human and pocket spawns stay unchanged", async () => {
    expect(api().spawn("bread", outlet, undefined, true, recipient)).toBeUndefined();
    expect(api().foods()).toHaveLength(0); expect(frames.size).toBe(0); expect(harness.commits).toBe(0);
    roomSource();
    expect(api().spawn("bread", outlet, undefined, true, { ...recipient, y: recipient.y + 1 })).toBeUndefined();
    expect(api().foods()).toHaveLength(0);
    const human = api().spawn("bread", outlet, undefined, false, { x: NaN, y: NaN })!;
    expect(api().foods()[0]).toMatchObject({ id: human, ...outlet });
    expect(harness.activity.mock.calls).toEqual([["ui.click", { target: "companion-food-spawn" }]]);
    harness.activity.mockClear(); expect(api().spawn("bread", outlet, undefined, true)).toEqual(expect.any(String));
    frame(3000); expect(api().foods()).toHaveLength(2); expect(harness.activity).not.toHaveBeenCalled();
  });
  it("respects pause and hidden ownership and keeps reduced or graphics-OFF ejection finite without animation frames", async () => {
    roomSource(); api().pause(true);
    expect(api().spawn("bread", outlet, undefined, true, recipient)).toBeUndefined();
    api().pause(false); hidden = true;
    expect(api().spawn("bread", outlet, undefined, true, recipient)).toBeUndefined(); hidden = false;
    reduce = true;
    const reducedId = api().spawn("bread", outlet, undefined, true, recipient)!;
    expect(api().foods()[0]).toMatchObject({ id: reducedId, platformId: room.id, y: recipient.y }); expect(frames.size).toBe(0);
    reduce = false; harness.graphics = "off"; harness.layouts[0]();
    const offId = api().spawn("bread", outlet, undefined, true, recipient)!;
    expect(api().foods().find(food => food.id === offId)).toMatchObject({ platformId: room.id, y: recipient.y });
    expect(frames.size).toBe(0); expect(harness.activity).not.toHaveBeenCalled();
  });
  it("does not let autonomous dispensing replace native selection, pointer capture or an in-progress trash action", async () => {
    roomSource(); const id = await spawn(); harness.activity.mockClear();
    invoke(id, "onKeyDown", { key: "Enter" });
    expect(api().spawn("bread", outlet, undefined, true, recipient)).toBeUndefined(); expect(api().contains(id)).toBe(true);
    invoke(id, "onKeyDown", { key: "Escape" }); frame(3000); await render();
    invoke(id, "onPointerDown");
    expect(api().spawn("bread", outlet, undefined, true, recipient)).toBeUndefined(); expect(nodeById.get(id)!.setPointerCapture).toHaveBeenCalledTimes(1);
    invoke(id, "onPointerUp"); frame(5000); await render();
    const bin = node(); bin.attributes.set("data-companion-trash", "");
    expect(api().beginCarry(id)).toBe(true); api().carry(id, { x: 622, y: 435 }); expect(api().discardCarry(id, bin as unknown as HTMLElement)).toBe(true);
    expect(api().spawn("bread", outlet, undefined, true, recipient)).toBeUndefined(); expect(bin.attributes.has("data-food-over")).toBe(true);
    vi.advanceTimersByTime(180); expect(api().contains(id)).toBe(false); expect(api().foods()).toHaveLength(0);
    expect(harness.activity).not.toHaveBeenCalled();
  });
  it("keeps one carried food logically current without frame React commits, consumption, discovery or activity", async () => {
    const id = await spawn(), other = await spawn(250);
    harness.activity.mockClear();
    expect(api().beginCarry(id)).toBe(true); expect(api().beginCarry(other)).toBe(false);
    const commits = harness.commits;
    for (let i = 0; i < 120; i++) expect(api().carry(id, { x: 300 + i, y: 240 + i / 2 })).toBe(true);
    expect(harness.commits).toBe(commits); expect(api().carried()).toBe(id); expect(api().contains(id)).toBe(true);
    expect(api().foods().map(item => item.id)).toEqual([other]); expect(api().consume(id)).toBe(false); expect(api().stash(id)).toBe(false);
    api().nibble(other, .4, { x: 260, y: 230 });
    expect(nodeById.get(id)!.style.transform).toBe("translate3d(419.000px,299.500px,0)");
    expect(api().carry(id, { x: NaN, y: 2 })).toBe(false); expect(api().carried()).toBe(id);
    expect(harness.activity).not.toHaveBeenCalled();
  });
  it("releases from the last actual carrying point onto the first real lower ledge with finite gravity", async () => {
    const first: Platform = { id: "card-first", kind: "card", x: 280, y: 420, width: 120 }, lower = { ...first, id: "card-lower", y: 580 };
    api().sync([lower, floor, first]); const id = await spawn(); harness.activity.mockClear();
    api().beginCarry(id); api().carry(id, { x: 330, y: 260 });
    expect(api().releaseCarry(id)).toBe(true); expect(api().carried()).toBeUndefined();
    expect(api().contains(id)).toBe(true); expect(api().foods()).toHaveLength(0); expect(nodeById.get(id)!.style.transform).toBe("translate3d(330.000px,260.000px,0)");
    frame(1080); expect(nodeById.get(id)!.style.transform).not.toContain("420.000px");
    frame(2600); expect(api().foods()[0]).toMatchObject({ id, x: 330, y: 420, platformId: first.id });
    expect(frames.size).toBe(0); expect(api().releaseCarry(id)).toBe(false); expect(harness.activity).not.toHaveBeenCalled();
  });
  it("native pointer capture or keyboard selection takes a carried food immediately, preserving existing move/discard logs", async () => {
    const id = await spawn(); api().beginCarry(id); api().carry(id, { x: 220, y: 320 }); harness.activity.mockClear();
    invoke(id, "onPointerDown", { clientX: 220, clientY: 304 });
    expect(api().carried()).toBeUndefined(); expect(api().carry(id, { x: 500, y: 500 })).toBe(false); expect(api().beginCarry(id)).toBe(false);
    invoke(id, "onPointerMove", { clientX: 320, clientY: 304 }); frame(1017);
    invoke(id, "onPointerUp", { clientX: 320, clientY: 304 }); frame(2700);
    expect(api().foods()[0].x).toBe(320); expect(harness.activity.mock.calls).toEqual([["ui.click", { target: "companion-food-move" }]]);
    api().beginCarry(id); await render(); invoke(id, "onKeyDown", { key: "Delete" });
    expect(api().carried()).toBeUndefined(); expect(api().contains(id)).toBe(false);
    expect(harness.activity.mock.calls.at(-1)).toEqual(["ui.click", { target: "companion-food-discard" }]);
  });
  it("cannot acquire falling, eating, hidden, selected or paused food", async () => {
    const falling = await spawn(200, 250, true); expect(api().beginCarry(falling)).toBe(false); frame(2800);
    const id = await spawn(350); api().nibble(id, .2, { x: 300, y: 250 }); expect(api().beginCarry(id)).toBe(false); api().nibble();
    invoke(id, "onKeyDown", { key: "Enter" }); expect(api().beginCarry(id)).toBe(false); expect(api().beginCarry(falling)).toBe(false);
    invoke(id, "onKeyDown", { key: "Escape" }); frame(4500); api().pause(true); expect(api().beginCarry(id)).toBe(false); api().pause(false);
    hidden = true; expect(api().beginCarry(id)).toBe(false); hidden = false;
    expect(api().beginCarry("missing")).toBe(false);
  });
  it("autonomous trash uses the existing finite animation and never creates a human activity", async () => {
    const id = await spawn(), bin = node(); bin.attributes.set("data-companion-trash", "");
    api().beginCarry(id); harness.activity.mockClear();
    expect(api().discardCarry(id, bin as unknown as HTMLElement)).toBe(false); expect(api().carried()).toBe(id);
    api().carry(id, { x: 622, y: 435 });
    expect(api().discardCarry(id, bin as unknown as HTMLElement)).toBe(true); expect(api().carried()).toBeUndefined(); expect(api().contains(id)).toBe(true);
    expect(api().foods()).toHaveLength(0); expect(bin.attributes.has("data-food-over")).toBe(true);
    vi.advanceTimersByTime(180);
    expect(api().contains(id)).toBe(false); expect(bin.attributes.has("data-food-over")).toBe(false); expect(harness.activity).not.toHaveBeenCalled();
  });
  it("pause/hidden/month clear and effect cleanup relinquish carry with no retained loop or stale owner", async () => {
    const id = await spawn(); api().beginCarry(id); api().carry(id, { x: 330, y: 260 }); api().pause(true);
    expect(api().carried()).toBeUndefined(); expect(api().contains(id)).toBe(true); expect(frames.size).toBe(0);
    await render(); api().pause(false); await render(); expect(api().beginCarry(id)).toBe(true);
    // Enabled cleanup, month rebinding and blocked pause precede the native
    // document input/visibility subscription in this component adapter.
    const dispose = harness.effects[3]() as () => void; hidden = true; documentEvents.get("visibilitychange")!();
    expect(api().carried()).toBeUndefined(); expect(frames.size).toBe(0); hidden = false;
    expect(api().beginCarry(id)).toBe(true); dispose(); expect(api().carried()).toBeUndefined(); expect(frames.size).toBe(0);
    await render(); expect(api().beginCarry(id)).toBe(true); harness.effects[0]();
    expect(api().carried()).toBeUndefined(); expect(api().contains(id)).toBe(false); expect(frames.size).toBe(0);
  });
  it("scatter physically moves at most three settled snacks, leaves held/eaten food alone and finishes without activity", async () => {
    const ids: string[] = []; for (let i = 0; i < 5; i++) ids.push(await spawn(180 + 20 * i, 300));
    api().beginCarry(ids[0]); api().nibble(ids[4], .3, { x: 310, y: 230 }); harness.activity.mockClear();
    const original = nodeById.get(ids[1])!.style.transform;
    expect(api().scatter({ x: 150, y: 300 }, 300, 2)).toBe(3);
    expect(api().foods()).toHaveLength(1); expect(api().carried()).toBe(ids[0]);
    frame(1100); expect(nodeById.get(ids[1])!.style.transform).not.toBe(original);
    frame(3000); expect(api().foods().find(item => item.id === ids[1])).toMatchObject({ platformId: floor.id, y: 770 });
    expect(api().foods().find(item => item.id === ids[1])!.x).toBeGreaterThan(200);
    expect(frames.size).toBe(0); expect(harness.activity).not.toHaveBeenCalled();
  });
  it("binds a thrown food to the actual DOM recipient and follows its scroll once", async () => {
    let top = 400;
    const source = { isConnected: true, closest: () => null, matches: () => false, getBoundingClientRect: () => ({ left: 150, top, width: 300, height: 60 }) };
    const ledge: Platform = { id: "actual-card", kind: "card", x: 160, width: 270, y: 400 };
    api().sync([ledge, floor], id => id === ledge.id ? { element: source, left: 150, top: 400 } as unknown as CompanionGeometryAnchor : undefined);
    const id = await spawn(); expect(api().scatter({ x: 180, y: 300 }, 60)).toBe(1); frame(3000);
    const before = api().foods()[0]; expect(before.platformId).toBe(ledge.id);
    top = 310; api().sync([ledge, floor]);
    expect(api().foods()[0]).toMatchObject({ id, x: before.x, y: before.y - 90, platformId: ledge.id });
  });
  it("retains maximum eight and autonomous pocket spawning semantics, even with carried food", async () => {
    const id = await spawn(); api().beginCarry(id); harness.activity.mockClear();
    for (let i = 0; i < 7; i++) expect(api().spawn("bread", { x: 300 + i * 20, y: 300 }, undefined, true)).toEqual(expect.any(String));
    expect(api().spawn("bread", { x: 300, y: 300 }, undefined, true)).toBeUndefined();
    expect(api().contains(id)).toBe(true); expect(api().carried()).toBe(id); expect(harness.activity).not.toHaveBeenCalled();
    api().clear(); expect(api().carried()).toBeUndefined(); expect(api().foods()).toHaveLength(0); expect(frames.size).toBe(0);
    expect(harness.activity.mock.calls).toEqual([["ui.click", { target: "companion-food-clear" }]]);
  });
  it("releases detached visibility and presentation entries through repeated pocket and carried-trash churn", async () => {
    const bin = node(); bin.attributes.set("data-companion-trash", "");
    for (let round = 0; round < 24; round++) {
      const id = await spawn(200, 300, true); frame(clock + 2000);
      const visibility = harness.refs.map(ref => ref.current).find(value => value instanceof Map && value.get(id) === true) as Map<string, boolean>;
      expect(visibility).toBeDefined(); expect(visibility.size).toBe(1);
      api().nibble(id, .4, { x: 250, y: 220 });
      const presentation = harness.refs.map(ref => ref.current).find(value => value instanceof Map && typeof value.get(id)?.scale === "number") as Map<string, unknown>;
      expect(presentation).toBeDefined();
      // Pocket capture removes the source before update. A detached carried
      // discard does the same; neither may retain old per-snack bookkeeping.
      expect(api().stash(id)).toBe(true); expect(visibility.size).toBe(0); expect(presentation.size).toBe(0);
      const carriedId = await spawn(200, 300, true); frame(clock + 2000);
      expect(api().beginCarry(carriedId)).toBe(true); api().carry(carriedId, { x: 622, y: 435 });
      expect(api().discardCarry(carriedId, bin as unknown as HTMLElement)).toBe(true); vi.advanceTimersByTime(180);
      expect(api().contains(carriedId)).toBe(false); expect(visibility.size).toBe(0); expect(presentation.size).toBe(0); expect(frames.size).toBe(0);
    }
    expect(harness.activity).not.toHaveBeenCalled();
  });
});
