// Controller ownership harness excludes the separately tested scene material hook.
vi.mock("@/lib/ui/scene-material", () => ({ useCompanionSceneMaterial: () => ({ apply: () => {} }) }));
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCompanionToys, createCompanionToyPlanner, companionToyFoodPriority, COMPANION_TOY_KINDS, MAX_COMPANION_TOYS, type CompanionToy } from "@/lib/ui/viewer-companion/toys";
import { createBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const component = vi.hoisted(() => ({ refs: [] as { current: unknown }[], refIndex: 0, states: [] as unknown[], stateIndex: 0, effects: [] as (() => void)[], layoutEffects: [] as (() => void)[], activity: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useRef: (initial: unknown) => component.refs[component.refIndex++] ?? (component.refs[component.refIndex - 1] = { current: initial }),
  useState: (initial: unknown) => { const index = component.stateIndex++; if (!(index in component.states)) component.states[index] = initial; return [component.states[index], (next: unknown) => { component.states[index] = typeof next === "function" ? next(component.states[index]) : next; }]; },
  useCallback: (callback: unknown) => callback,
  // This direct-call controller harness reads the store at each explicit render.
  useSyncExternalStore: (_subscribe: unknown, getSnapshot: () => unknown) => getSnapshot(),
  useEffect: (callback: () => void) => { component.effects.push(callback); },
  // This harness commits callbacks at its explicit render boundary; native
  // layout timing and visibility are exercised in the browser regression.
  useLayoutEffect: (callback: () => void) => { component.layoutEffects.push(callback); },
  useImperativeHandle: (ref: { current: unknown }, create: () => unknown) => { ref.current = create(); }
}));
vi.mock("@/lib/activity/client", () => ({ logActivity: component.activity }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const bounds = { width: 1000, height: 700 };
const floor: Platform = { id: "floor", x: 0, y: 600, width: 1000, kind: "floor" };
const make = (platforms: readonly Platform[] = [floor]) => { const model = createCompanionToys(() => 0); model.sync(platforms, bounds, 0); return model; };
type Model = ReturnType<typeof createCompanionToys>;
const settle = (model: Model, start = 0) => { for (let at = start + 16; at <= start + 1800; at += 16) model.tick(at); };
const point = { x: 600, y: 500, platformId: floor.id };
function settled(model = make()) { const id = model.spawn(point, 0)!; settle(model); return { model, id, toy: model.available()[0] }; }
function context(personality: "tidy" | "mischievous" = "tidy", toys: readonly CompanionToy[] = []) {
  return { world: { x: 100, y: floor.y, platformId: floor.id, platforms: [floor], width: bounds.width, height: bounds.height, animated: true } as CompanionWorld,
    brain: { ...createBrain(0, () => .5), hunger: .1, energy: .9 }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality }, now: 2000, toys, count: toys.length, box: { x: 100, y: floor.y, platformId: floor.id } };
}

describe("real bounded companion toy objects", () => {
  it("spawns four separately identified real objects, respects capacity and lands on the first crossed safe support", () => {
    const first = { ...floor, id: "first", y: 350 }, second = { ...floor, id: "second", y: 500 };
    const model = make([{ ...floor, id: "control", kind: "control", y: 250 }, { ...floor, id: "hidden", kind: "hide", y: 300 }, first, second, floor]);
    const ids = Array.from({ length: 5 }, () => model.spawn({ x: 600, y: 200 }, 0));
    expect(ids.slice(0, 4).every(Boolean)).toBe(true); expect(ids[4]).toBeUndefined();
    expect(model.items()).toHaveLength(MAX_COMPANION_TOYS); expect(model.items().map(toy => toy.kind)).toEqual([COMPANION_TOY_KINDS[0], COMPANION_TOY_KINDS[1], COMPANION_TOY_KINDS[0], COMPANION_TOY_KINDS[1]]);
    expect(new Set(model.items().map(toy => toy.id)).size).toBe(MAX_COMPANION_TOYS);
    model.tick(100); expect(model.items()[0].y).toBeLessThan(200); expect(model.items()[0].x).toBeLessThan(600);
    settle(model, 100);
    expect(model.moving()).toBe(false); expect(model.available()).toHaveLength(4);
    expect(model.items().every(toy => toy.platformId === first.id && toy.y === first.y && toy.angle === 0)).toBe(true);
    const copy = model.items()[0]; copy.x = -1000; expect(model.items()[0].x).toBeGreaterThan(0);
  });

  it("keeps settled coordinates relative to support reflow and safely bounds narrow supports", () => {
    const original = { ...floor, x: 100, width: 700 }, { model, id, toy } = settled(make([original]));
    const next = { ...original, x: 200, width: 300, y: 550 };
    model.sync([next], bounds, 2000);
    expect(model.items()[0]).toMatchObject({ id, x: next.x + next.width * toy.fraction!, y: next.y, platformId: next.id });
    const narrow = { ...next, x: 400, width: 12 };
    model.sync([narrow], bounds, 2100);
    expect(model.items()[0].x).toBeGreaterThanOrEqual(narrow.x); expect(model.items()[0].x).toBeLessThanOrEqual(narrow.x + narrow.width);
    expect(model.items()[0].fraction).toBeGreaterThanOrEqual(0); expect(model.items()[0].fraction).toBeLessThanOrEqual(1);
  });

  it("lets a user hold a flying toy first and prevents an autonomous pick until a real drop settles", () => {
    const model = make(), id = model.spawn(point, 0)!;
    expect(model.grab(id)).toBe(true); expect(model.moving()).toBe(false); expect(model.available()).toEqual([]);
    expect(model.drag(id, { x: 800, y: 500 })).toBe(true);
    expect(model.pick(id, { x: 800, y: 500 })).toBe(false);
    expect(model.drop(id, 100)).toBe(true); expect(model.pick(id, { x: 800, y: 500 })).toBe(false);
    settle(model, 100);
    const toy = model.available()[0]; expect(model.pick(id, { x: toy.x - 100, y: toy.y })).toBe(false);
    expect(model.pick(id, toy)).toBe(true); expect(model.carried()).toBe(id); expect(model.available()).toEqual([]);
    expect(model.carry(id, { x: 400, y: 560 })).toBe(true); expect(model.items()[0]).toMatchObject({ x: 400, y: 560, carried: true });
  });

  it("allows only an actual picked toy to be stashed, put or tossed", () => {
    const { model, id, toy } = settled();
    expect(model.stash(id)).toBe(false); expect(model.put(id, toy, 2000, true)).toBe(false);
    expect(model.items()).toHaveLength(1);
    expect(model.pick(id, toy)).toBe(true);
    expect(model.put(id, { x: 300, y: floor.y, platformId: floor.id }, 2000)).toBe(true);
    expect(model.items()[0]).toMatchObject({ carried: false, platformId: floor.id, x: 300, y: floor.y });
    expect(model.pick(id, model.items()[0])).toBe(true);
    expect(model.put(id, { x: 300, y: 560, platformId: floor.id }, 2100, true)).toBe(true);
    expect(model.moving()).toBe(true); expect(model.stash(id)).toBe(false);
    settle(model, 2100);
    expect(model.pick(id, model.items()[0])).toBe(true); expect(model.stash(id)).toBe(true);
    expect(model.items()).toEqual([]); expect(model.stash(id)).toBe(false);
  });

  it("freezes the displayed flight through repeated hidden pauses and resumes without absence catch-up", () => {
    const model = make(), id = model.spawn(point, 0)!;
    model.tick(120); const before = model.items()[0];
    model.pause(150); model.pause(5000); model.tick(9000);
    expect(model.items()[0]).toEqual(before); expect(model.moving()).toBe(false);
    expect(model.grab(id)).toBe(false); expect(model.spawn(point, 9000)).toBeUndefined();
    model.resume(10000); model.tick(10000);
    expect(model.items()[0]).toEqual(before); expect(model.moving()).toBe(true);
    model.tick(10016); expect(model.items()[0].y).not.toBe(before.y); expect(model.items()[0].platformId).toBeUndefined();
    settle(model, 10016); expect(model.available()).toHaveLength(1);
  });

  it("drops keyboard holds and creature carry in place before freezing, rather than leaving a hidden owner", () => {
    const { model, id, toy } = settled();
    expect(model.grab(id)).toBe(true); model.drag(id, { x: 450, y: 400 });
    model.pause(2000); expect(model.items()[0]).toMatchObject({ x: 450, y: 400, held: false, carried: false });
    expect(model.carried()).toBeUndefined(); model.tick(20000); expect(model.items()[0].y).toBe(400);
    model.resume(20000); model.tick(20000); expect(model.items()[0].y).toBe(400);
    settle(model, 20000); expect(model.pick(id, model.items()[0])).toBe(true);
    model.carry(id, { x: toy.x, y: 560 }); model.pause(22000);
    expect(model.carried()).toBeUndefined(); expect(model.items()[0].carried).toBe(false);
  });

  it("falls onto a real lower replacement and preserves an unsupported toy without an endless recovery clock", () => {
    const { model, id } = settled();
    const lower = { ...floor, id: "lower", y: 650 };
    model.sync([lower], bounds, 2000); expect(model.available()).toEqual([]);
    model.tick(2400); expect(model.items()[0]).toMatchObject({ platformId: lower.id, y: lower.y });
    model.sync([], bounds, 2500); model.tick(4600); model.tick(6700);
    expect(model.items()).toHaveLength(1); expect(model.items()[0]).toMatchObject({ id, platformId: undefined, hidden: false }); expect(model.moving()).toBe(false);
    expect(model.available()).toEqual([]); expect(model.grab(id)).toBe(true);
  });

  it("rejects invalid viewport/clock input without poisoning current coordinates or the four-object bound", () => {
    const model = createCompanionToys();
    model.sync([floor], { width: NaN, height: 700 }, 0); expect(model.spawn(point, 0)).toBeUndefined();
    model.sync([{ ...floor, x: NaN }, { ...floor, width: -10 }, floor], bounds, 0);
    const id = model.spawn(point, 0)!;
    model.tick(100); const before = model.items(); model.tick(NaN); model.tick(-100);
    model.sync([floor], { width: 0, height: Infinity }, 200); expect(model.items()).toEqual(before);
    expect(model.pick(id, { x: NaN, y: 500 })).toBe(false);
    expect(model.grab(id)).toBe(true); expect(model.drop(id, NaN)).toBe(false);
    expect(model.drop(id, 200, { x: NaN, y: Infinity })).toBe(true);
    settle(model, 200); expect(model.items().every(toy => [toy.x, toy.y, toy.angle].every(Number.isFinite))).toBe(true);
  });
});

describe("actual toy planner effects and acknowledgements", () => {
  it("never steals a committed food or care intention, including carried-toy continuation", () => {
    const input = context("mischievous");
    const goals = [
      { ...input.brain, foodGoal: { foodId: "meal", remaining: 4, retryAfter: 0 } },
      { ...input.brain, intention: { kind: "feed" as const, targetId: floor.id, offset: .5, remaining: 4, stage: "travel" as const } },
    ];
    for (const brain of goals) {
      expect(companionToyFoodPriority(brain, input.world, input.preferences)).toBe(true);
      expect(createCompanionToyPlanner().next({ ...input, brain })).toBeUndefined();
    }
    expect(companionToyFoodPriority(input.brain, input.world, input.preferences)).toBe(false);
  });

  it("skips an unreachable nearest object to approach another reachable toy within the four-object search", () => {
    const blocked = { ...floor, id: "isolated", x: 80, width: 80, y: 500 };
    const near: CompanionToy = { id: "blocked-toy", kind: "ball", x: 100, y: blocked.y, platformId: blocked.id, angle: 0, held: false, carried: false };
    const far: CompanionToy = { ...near, id: "reachable-toy", x: 700, y: floor.y, platformId: floor.id };
    for (const personality of ["tidy", "mischievous"] as const) {
      const input = context(personality, [near, far]); input.preferences.jump = false; input.world.platforms = [floor, blocked];
      const action = createCompanionToyPlanner().next(input)!;
      expect(action).toMatchObject({ kind: "walk", target: { x: far.x, y: far.y, platformId: floor.id } });
      expect(action.toy.kind).toBe(personality === "tidy" ? "tidy" : "play");
    }
  });
  it("tidies via a real approach, successful mouth-range pick and measured return before stash acknowledgement", () => {
    const { model, id } = settled(), planner = createCompanionToyPlanner(); let input = context("tidy", model.available());
    const approach = planner.next(input)!; expect(approach).toMatchObject({ kind: "walk", toy: { kind: "tidy" } });
    expect(approach.toy.effect).toBeUndefined(); expect(model.items()).toHaveLength(1);
    input = { ...input, world: { ...input.world, ...approach.target }, now: input.now + approach.duration };
    const pick = planner.next(input)!; expect(pick.toy).toMatchObject({ effect: "pick", toyId: id });
    const picked = model.pick(id, input.world); expect(picked).toBe(true); planner.resolve(pick.toy, picked, input.now);
    input = { ...input, toys: model.available(), now: input.now + pick.duration };
    const returnToBox = planner.next(input)!; expect(returnToBox).toMatchObject({ kind: "walk", target: input.box });
    input = { ...input, world: { ...input.world, ...returnToBox.target }, now: input.now + returnToBox.duration };
    const stash = planner.next(input)!; expect(stash.toy).toMatchObject({ effect: "stash", toyId: id });
    expect(model.carried()).toBe(id); const stashed = model.stash(id); planner.resolve(stash.toy, stashed, input.now);
    expect(stashed).toBe(true); expect(model.items()).toEqual([]); expect(planner.active()).toBe(true);
    planner.resolve(pick.toy, true, input.now + 1); expect(planner.active()).toBe(true);
    expect(planner.next({ ...input, toys: model.available(), existingIds: model.ids(), carriedId: model.carried(), count: model.count(), now: input.now + stash.duration })).toBeUndefined();
    expect(planner.active()).toBe(false);
    planner.resolve(pick.toy, true, input.now + 1); expect(planner.active()).toBe(false);
  });

  it("plays only after the actual pick succeeds and releases the same object on toss acknowledgement", () => {
    const { model, id } = settled(), planner = createCompanionToyPlanner(); let input = context("mischievous", model.available());
    expect(planner.playfulCarry(input.world)).toBeUndefined();
    const approach = planner.next(input)!; input = { ...input, world: { ...input.world, ...approach.target }, now: input.now + approach.duration };
    const pick = planner.next(input)!, picked = model.pick(id, input.world); expect(picked).toBe(true);
    planner.resolve(pick.toy, picked, input.now);
    const toss = planner.playfulCarry(input.world)!; expect(toss).toMatchObject({ kind: "play", play: "pounce", toy: { effect: "toss", toyId: id } });
    expect(toss.duration).toBeGreaterThan(0); expect(toss.duration).toBeLessThan(3000);
    const released = model.put(id, { x: input.world.x, y: input.world.y - 30 }, input.now, true); planner.resolve(toss.toy, released, input.now);
    expect(released).toBe(true); expect(model.items()[0].id).toBe(id); expect(model.carried()).toBeUndefined(); expect(model.moving()).toBe(true); expect(planner.active()).toBe(false);
  });

  it("honors failed effects, native cancellation, hidden/pause, food priority, missing support and the action budget", () => {
    const toy = settled().toy, input = context("tidy", [toy]);
    for (const patch of [{ world: { ...input.world, paused: true } }, { preferences: { ...input.preferences, enabled: false } }, { preferences: { ...input.preferences, roam: false } }, { box: undefined }, { brain: { ...input.brain, hunger: .8 }, world: { ...input.world, foods: [{ id: "actual-food", kind: "apple" as const, x: 200, y: 600, platformId: floor.id }] } }]) expect(createCompanionToyPlanner().next({ ...input, ...patch })).toBeUndefined();
    const failed = createCompanionToyPlanner(); const walk = failed.next(input)!;
    const pick = failed.next({ ...input, world: { ...input.world, ...walk.target } })!;
    failed.resolve(pick.toy, false, input.now); expect(failed.active()).toBe(false); expect(failed.playfulCarry(input.world)).toBeUndefined();
    const interrupted = createCompanionToyPlanner(); interrupted.next(input); interrupted.cancel(input.now); expect(interrupted.active()).toBe(false);
    expect(interrupted.next(input)).toBeUndefined();
    const deleted = createCompanionToyPlanner(); deleted.next(input); expect(deleted.next({ ...input, toys: [] })).toBeUndefined(); expect(deleted.active()).toBe(false);
    const budget = createCompanionToyPlanner();
    for (let i = 0; i < 18; i++) expect(budget.next(input)?.kind).toBe("walk");
    expect(budget.next(input)).toBeUndefined(); expect(budget.active()).toBe(false);
    const missing = { ...input, world: { ...input.world, platforms: [] } };
    expect(createCompanionToyPlanner().next(missing)).toBeUndefined();
  });

  it("spawns only through a real box effect and acknowledgement below capacity", () => {
    const planner = createCompanionToyPlanner(), input = context("mischievous");
    const action = planner.next(input)!; expect(action.toy.effect).toBe("spawn");
    const model = make(), id = model.spawn(input.box, input.now)!; planner.resolve(action.toy, id, input.now);
    expect(model.items()).toHaveLength(1); expect(planner.active()).toBe(true);
    const full = { ...input, count: MAX_COMPANION_TOYS };
    expect(createCompanionToyPlanner().next(full)).toBeUndefined();
    expect(createCompanionToyPlanner().next({ ...input, preferences: { ...input.preferences, ambientPrank: false } })).toBeUndefined();
  });
});

describe("shared native toy controller ownership", () => {
  function presentationMethods() {
    const attributes = new Set<string>();
    return {
      toggleAttribute: (name: string, force: boolean) => { if (force) attributes.add(name); else attributes.delete(name); return force; },
      querySelector: () => null,
    };
  }
  async function harness() {
    component.refs = []; component.states = []; component.activity.mockReset();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal("React", await import("react")); vi.spyOn(performance, "now").mockReturnValue(2000);
    const { CompanionToys } = await import("@/components/poster/viewer-companion/companion-toys");
    const ref: { current: import("@/components/poster/viewer-companion/companion-toys").CompanionToyControl | null } = { current: null }, onActivity = vi.fn(), onExperience = vi.fn();
    const render = (blocked = false) => {
      component.refIndex = component.stateIndex = 0; component.effects = []; component.layoutEffects = [];
      const tree = (CompanionToys as unknown as { render: (props: unknown, ref: unknown) => ReactElement }).render({ blocked, onActivity, onCount: vi.fn(), onExperience }, ref);
      component.layoutEffects.forEach(effect => effect()); component.effects.forEach(effect => effect()); return tree;
    };
    render(); ref.current!.sync([floor], bounds, 0); ref.current!.spawn(point, 0);
    const tree = render(), button = (tree.props as { children: ReactElement[] }).children[0] as ReactElement<Record<string, unknown>>;
    return { ref, render, button, onActivity, onExperience };
  }

  async function heldOverBox() {
    const frames = new Map<number, FrameRequestCallback>(); let frameId = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    const frame = () => { for (const [id, callback] of [...frames]) { frames.delete(id); callback(2020); } };
    const attrs = new Map<string, string>();
    const box = { disabled: false, getAttribute: (key: string) => attrs.get(key) ?? null, closest: () => null,
      getBoundingClientRect: vi.fn(() => ({ left: 500, right: 580, top: 300, bottom: 360 })), setAttribute: (key: string, value: string) => attrs.set(key, value), removeAttribute: (key: string) => attrs.delete(key) };
    vi.stubGlobal("document", { querySelector: () => box });
    const h = await harness(); h.ref.current!.tick(1800); const actual = h.ref.current!.available()[0];
    const node = { ...presentationMethods(), style: { transform: "", setProperty: vi.fn() }, dataset: {} as Record<string, string>, hidden: false, setPointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true), releasePointerCapture: vi.fn() };
    (h.button.props.ref as (node: unknown) => void)(node);
    const event = (x = actual.x, y = actual.y) => ({ button: 0, pointerId: 7, clientX: x, clientY: y, currentTarget: node, preventDefault: vi.fn(), stopPropagation: vi.fn() });
    (h.button.props.onPointerDown as (event: unknown) => void)(event());
    (h.button.props.onPointerMove as (event: unknown) => void)(event(492, 292));
    frame();
    expect(attrs.has("data-toy-over")).toBe(true);
    return { ...h, attrs, box, node, event, frame, frames };
  }

  async function carriedPerformance() {
    const h = await harness(), control = h.ref.current!;
    const style = { visibility: "visible", display: "block", opacity: "1" };
    const document = { hidden: false, defaultView: { getComputedStyle: vi.fn(() => style) } }; vi.stubGlobal("document", document);
    const node = { ...presentationMethods(), ownerDocument: document, style: { transform: "", setProperty: vi.fn() }, dataset: {} as Record<string, string>, hidden: false, isConnected: true, getBoundingClientRect: vi.fn(() => ({ left: 410, top: 330, width: 44, height: 44 })) };
    (h.button.props.ref as (node: unknown) => void)(node);
    control.tick(1800); const actual = control.available()[0]; h.onExperience.mockClear();
    return { ...h, control, node, actual, document, style };
  }

  it("highlights the real box under pointer capture and returns only at the same measured release boundary", async () => {
    const h = await heldOverBox();
    (h.button.props.onPointerMove as (event: unknown) => void)(h.event(491.99, 292)); h.frame(); expect(h.attrs.has("data-toy-over")).toBe(false);
    (h.button.props.onPointerMove as (event: unknown) => void)(h.event(492, 292)); h.frame(); expect(h.attrs.has("data-toy-over")).toBe(true);
    (h.button.props.onPointerUp as (event: unknown) => void)(h.event(492, 292));
    expect(h.attrs.has("data-toy-over")).toBe(false); expect(h.ref.current!.count()).toBe(0);
    expect(component.activity.mock.calls.at(-1)).toEqual(["ui.click", { target: "companion-toy-return" }]);
    expect(h.onExperience.mock.calls.at(-1)).toEqual(["ball", "tidied"]);
  });

  it("coalesces a high-rate pointer burst into one box measurement on the existing display frame", async () => {
    const h = await heldOverBox(); h.box.getBoundingClientRect.mockClear();
    for (let i = 0; i < 200; i++) (h.button.props.onPointerMove as (event: unknown) => void)(h.event(492 + i * .01, 292));
    expect(h.box.getBoundingClientRect).not.toHaveBeenCalled(); expect(h.frames.size).toBe(1);
    h.frame(); expect(h.box.getBoundingClientRect).toHaveBeenCalledTimes(1); expect(h.attrs.has("data-toy-over")).toBe(true);
    (h.button.props.onPointerCancel as (event: unknown) => void)(h.event(494, 292));
  });

  it("transfers a pointer hold to native Escape without a stale capture, pending frame or later accidental return", async () => {
    const h = await heldOverBox(); component.activity.mockClear();
    (h.button.props.onKeyDown as (event: unknown) => void)({ key: "Escape", preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(h.attrs.has("data-toy-over")).toBe(false); expect(h.frames.size).toBe(0); expect(h.node.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(component.activity.mock.calls).toEqual([["ui.click", { target: "companion-toy-drop" }]]);
    (h.button.props.onPointerUp as (event: unknown) => void)(h.event(492, 292));
    expect(h.ref.current!.count()).toBe(1); expect(component.activity.mock.calls).toHaveLength(1);
  });

  it.each(["pointer-cancel", "lost-capture", "pause", "blocked", "unmount", "planner-cancel"])("clears captured feedback at %s without a fabricated return or cancelling an unrelated human hold", async mode => {
    const h = await heldOverBox(); component.activity.mockClear();
    if (mode === "pause") h.ref.current!.pause(2100);
    else if (mode === "blocked") h.render(true);
    // Optional retained-session flight/subscription/input effects precede pause cleanup.
    else if (mode === "unmount") { const cleanup = component.effects[4]() as unknown as () => void; cleanup(); }
    else {
      if (mode === "planner-cancel") { h.ref.current!.cancel(2100); expect(h.attrs.has("data-toy-over")).toBe(true); }
      const key = mode === "lost-capture" ? "onLostPointerCapture" : "onPointerCancel";
      (h.button.props[key] as (event: unknown) => void)(h.event(492, 292));
    }
    expect(h.attrs.has("data-toy-over")).toBe(false); expect(h.ref.current!.count()).toBe(1);
    expect(component.activity.mock.calls.some(([, options]) => options.target === "companion-toy-return")).toBe(false);
  });

  it("preserves an off-centre grab, coalesces to the newest native point, and flushes pointerup before the queued frame", async () => {
    const frames = new Map<number, FrameRequestCallback>(); let serial = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; }); vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    vi.stubGlobal("document", { querySelector: () => null });
    const h = await harness(); h.ref.current!.tick(1800); const actual = h.ref.current!.available()[0];
    const node = { ...presentationMethods(), style: { transform: "", setProperty: vi.fn() }, dataset: {} as Record<string, string>, hidden: false, setPointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true), releasePointerCapture: vi.fn() };
    (h.button.props.ref as (node: unknown) => void)(node);
    const start = { x: actual.x - 13, y: actual.y - 31 }, event = (point = start) => ({ button: 0, pointerId: 7, clientX: point.x, clientY: point.y, currentTarget: node, preventDefault: vi.fn(), stopPropagation: vi.fn() });
    (h.button.props.onPointerDown as (event: unknown) => void)(event()); const initial = node.style.transform;
    vi.mocked(performance.now).mockReturnValue(2010); (h.button.props.onPointerMove as (event: unknown) => void)(event({ x: start.x + 15, y: start.y + 10 }));
    vi.mocked(performance.now).mockReturnValue(2020); (h.button.props.onPointerMove as (event: unknown) => void)(event({ x: start.x + 30, y: start.y + 20 }));
    expect(frames.size).toBe(1); expect(node.style.transform).toBe(initial);
    const due = [...frames.values()]; frames.clear(); due.forEach(callback => callback(2033));
    expect(node.style.transform).toContain(`translate3d(${(actual.x + 30).toFixed(3)}px,${(actual.y + 20).toFixed(3)}px,0)`);
    vi.mocked(performance.now).mockReturnValue(2040); (h.button.props.onPointerMove as (event: unknown) => void)(event({ x: start.x + 40, y: start.y + 30 }));
    vi.mocked(performance.now).mockReturnValue(2050); (h.button.props.onPointerUp as (event: unknown) => void)(event({ x: start.x + 50, y: start.y + 40 }));
    expect(frames.size).toBe(0); expect(node.style.transform).toContain(`translate3d(${(actual.x + 50).toFixed(3)}px,${(actual.y + 40).toFixed(3)}px,0)`);
    h.ref.current!.tick(2066); expect(Number(node.style.transform.match(/translate3d\(([-\d.]+)/)![1])).toBeGreaterThan(actual.x + 50);
    expect(component.activity.mock.calls.map(call => call[1].target)).toEqual(["companion-toy-grab", "companion-toy-drop"]);
  });

  it("cancel drops from the latest held point without a fling, frame tail or fabricated drop event", async () => {
    const frames = new Map<number, FrameRequestCallback>(); let serial = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; }); vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    const h = await harness(); h.ref.current!.tick(1800); const actual = h.ref.current!.available()[0];
    const node = { ...presentationMethods(), style: { transform: "", setProperty: vi.fn() }, dataset: {} as Record<string, string>, hidden: false, setPointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true), releasePointerCapture: vi.fn() }; (h.button.props.ref as (node: unknown) => void)(node);
    const event = { button: 0, pointerId: 9, clientX: actual.x, clientY: actual.y - 22, currentTarget: node, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    (h.button.props.onPointerDown as (event: unknown) => void)(event);
    vi.mocked(performance.now).mockReturnValue(2020); (h.button.props.onPointerMove as (event: unknown) => void)({ ...event, clientX: actual.x + 40 });
    (h.button.props.onPointerCancel as (event: unknown) => void)({ ...event, clientX: actual.x + 40 });
    expect(frames.size).toBe(0); expect(node.releasePointerCapture).toHaveBeenCalledOnce(); h.ref.current!.tick(2036);
    expect(node.style.transform).toContain(`translate3d(${(actual.x + 40).toFixed(3)}px,`);
    expect(component.activity.mock.calls).toEqual([["ui.click", { target: "companion-toy-grab" }]]);
  });

  it("planner cancellation preserves a native pointer hold; blocked transition releases capture and freezes the drop", async () => {
    const h = await harness(), node = { setPointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true), releasePointerCapture: vi.fn() };
    (h.button.props.onPointerDown as (event: unknown) => void)({ button: 0, pointerId: 7, clientX: 600, clientY: 500, currentTarget: node, preventDefault: vi.fn(), stopPropagation: vi.fn() });
    h.ref.current!.cancel(100); expect(node.releasePointerCapture).not.toHaveBeenCalled(); expect(h.ref.current!.moving()).toBe(false); expect(h.ref.current!.available()).toEqual([]);
    h.render(true); expect(node.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(7); expect(h.ref.current!.moving()).toBe(false);
    h.ref.current!.tick(20000); expect(h.ref.current!.moving()).toBe(false);
    vi.mocked(performance.now).mockReturnValue(20000); h.render(false); expect(h.ref.current!.moving()).toBe(true);
    expect(component.activity.mock.calls).toEqual([["ui.click", { target: "companion-toy-grab" }]]);
  });

  it("quiet presence pause releases native capture once and ignores stale pointerup without a fake drop", async () => {
    const h = await harness(), node = { setPointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true), releasePointerCapture: vi.fn() };
    const event = { button: 0, pointerId: 9, clientX: 600, clientY: 500, currentTarget: node, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    (h.button.props.onPointerDown as (event: unknown) => void)(event);
    h.ref.current!.pause(2000); h.ref.current!.pause(3000);
    expect(node.releasePointerCapture).toHaveBeenCalledExactlyOnceWith(9);
    (h.button.props.onPointerUp as (event: unknown) => void)(event);
    h.ref.current!.tick(30000); expect(h.ref.current!.moving()).toBe(false);
    expect(component.activity.mock.calls).toEqual([["ui.click", { target: "companion-toy-grab" }]]);
    h.ref.current!.resume(30000); expect(h.ref.current!.moving()).toBe(true);
  });

  it("planner cancellation preserves a keyboard hold and blocking safely releases it without a fabricated human drop", async () => {
    const h = await harness();
    (h.button.props.onKeyDown as (event: unknown) => void)({ key: "Enter", preventDefault: vi.fn(), stopPropagation: vi.fn() });
    h.ref.current!.cancel(100); expect(h.ref.current!.moving()).toBe(false); expect(h.ref.current!.available()).toEqual([]);
    h.render(true); h.ref.current!.tick(20000); expect(h.ref.current!.moving()).toBe(false);
    vi.mocked(performance.now).mockReturnValue(20000); h.render(false); expect(h.ref.current!.moving()).toBe(true);
    expect(component.activity.mock.calls).toEqual([["ui.click", { target: "companion-toy-grab" }]]);
  });

  it("keyboard arrows take native priority once, repeated motion adds no fake grab and Escape records only the successful drop", async () => {
    const h = await harness(); h.onActivity.mockClear();
    const preventDefault = vi.fn(), stopPropagation = vi.fn();
    const press = (key: string) => (h.button.props.onKeyDown as (event: unknown) => void)({ key, preventDefault, stopPropagation });
    press("ArrowRight"); press("ArrowDown");
    expect(h.onActivity.mock.calls).toEqual([[true], [true]]);
    expect(component.activity.mock.calls).toEqual([["ui.click", { target: "companion-toy-grab" }]]);
    h.ref.current!.cancel(2000); expect(h.ref.current!.moving()).toBe(false);
    press("Escape"); press("Escape");
    expect(component.activity.mock.calls).toEqual([["ui.click", { target: "companion-toy-grab" }], ["ui.click", { target: "companion-toy-drop" }]]);
    expect(h.onActivity.mock.calls).toEqual([[true], [true], [true]]); expect(h.ref.current!.moving()).toBe(true);
    expect(stopPropagation).toHaveBeenCalledTimes(3); expect(preventDefault).toHaveBeenCalledTimes(3);
    press("x"); expect(stopPropagation).toHaveBeenCalledTimes(3); expect(preventDefault).toHaveBeenCalledTimes(3);
  });
  it("records only observed completed real play/refusal acknowledgements, never generic put or cancelled playback", async () => {
    const h = await harness(), control = h.ref.current!;
    vi.stubGlobal("document", { hidden: false });
    const rect = { left: 410, top: 330, width: 44, height: 44 };
    const node = { ...presentationMethods(), style: { transform: "", setProperty: vi.fn() }, dataset: {} as Record<string, string>, hidden: false, isConnected: true, getBoundingClientRect: vi.fn(() => rect) };
    (h.button.props.ref as (node: unknown) => void)(node);
    // A unit DOM node with its own measured rectangle. The completion source
    // must use this displayed centroid, rather than the model's floor point.
    const source = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    control.tick(1800); let actual = control.available()[0];
    expect(h.onExperience.mock.calls).toEqual([["ball", "taken-out"]]); h.onExperience.mockClear();
    expect(control.pick(actual.id, actual)).toBe(true); expect(control.put(actual.id, actual, 2000)).toBe(true);
    control.completePlay(actual.id); expect(h.onExperience).not.toHaveBeenCalled();
    expect(control.pick(actual.id, actual)).toBe(true); expect(control.put(actual.id, actual, 2100, false, true)).toBe(true);
    control.completePlay(actual.id, false); expect(h.onExperience).not.toHaveBeenCalled();
    expect(control.pick(actual.id, actual)).toBe(true); expect(control.put(actual.id, actual, 2200, false, true)).toBe(true);
    control.cancel(2200); control.completePlay(actual.id); expect(h.onExperience).not.toHaveBeenCalled();
    expect(control.pick(actual.id, actual)).toBe(true); expect(control.put(actual.id, actual, 2300, false, true)).toBe(true);
    control.completePlay(actual.id); control.completePlay(actual.id);
    expect(h.onExperience.mock.calls).toEqual([["ball", "played", source]]);
    expect(control.decline(actual.id, { x: actual.x - 200, y: actual.y }, 2400)).toBe(false);
    expect(control.decline(actual.id, actual, 2400)).toBe(true); expect(control.moving()).toBe(true);
    control.completePlay(actual.id); control.completePlay(actual.id);
    expect(h.onExperience.mock.calls).toEqual([["ball", "played", source], ["ball", "declined", source]]);
    control.tick(4000); actual = control.available()[0]; expect(actual).toBeDefined();
    expect(control.pick(actual.id, actual)).toBe(true); expect(control.stash(actual.id)).toBe(true);
    expect(h.onExperience.mock.calls.at(-1)).toEqual(["ball", "tidied"]);
  });
  it.each(["hidden-document", "detached-node", "hidden-node", "empty-rectangle"] as const)("consumes a pending ACK without discovery when its actual presentation is %s", async boundary => {
    const h = await harness(), control = h.ref.current!;
    const document = { hidden: false }; vi.stubGlobal("document", document);
    const node = { ...presentationMethods(), style: { transform: "", setProperty: vi.fn() }, dataset: {} as Record<string, string>, hidden: false, isConnected: true, getBoundingClientRect: vi.fn(() => ({ left: 410, top: 330, width: boundary === "empty-rectangle" ? 0 : 44, height: 44 })) };
    (h.button.props.ref as (node: unknown) => void)(node);
    control.tick(1800); const actual = control.available()[0]; h.onExperience.mockClear();
    expect(control.pick(actual.id, actual)).toBe(true); expect(control.put(actual.id, actual, 2000, false, true)).toBe(true);
    if (boundary === "hidden-document") document.hidden = true;
    if (boundary === "detached-node") node.isConnected = false;
    if (boundary === "hidden-node") node.hidden = true;
    control.completePlay(actual.id); expect(h.onExperience).not.toHaveBeenCalled();
    document.hidden = node.hidden = false; node.isConnected = true;
    node.getBoundingClientRect.mockReturnValue({ left: 410, top: 330, width: 44, height: 44 });
    control.completePlay(actual.id); expect(h.onExperience).not.toHaveBeenCalled();
  });
  it("records one observed authored carried performance per real pickup, using the current displayed centroid", async () => {
    const h = await carriedPerformance(), { control, actual } = h;
    expect(control.completeCarriedPlay(actual.id, true)).toBe(false);
    expect(control.pick(actual.id, actual)).toBe(true);
    expect(control.completeCarriedPlay("missing-id", true)).toBe(false);
    control.completePlay(actual.id, true); expect(h.onExperience).not.toHaveBeenCalled();
    expect(control.completeCarriedPlay(actual.id, true)).toBe(true);
    expect(control.completeCarriedPlay(actual.id, true)).toBe(false);
    expect(h.onExperience.mock.calls).toEqual([["ball", "played", { x: 432, y: 352 }]]);
    expect(control.carried()).toBe(actual.id); expect(h.node.getBoundingClientRect).toHaveBeenCalledOnce();
    expect(control.put(actual.id, actual, 2200)).toBe(true);
    expect(control.pick(actual.id, actual)).toBe(true);
    expect(control.completeCarriedPlay(actual.id, true)).toBe(true);
    expect(h.onExperience).toHaveBeenCalledTimes(2);
  });
  it("does not turn an unwitnessed carried performance into a later replayed discovery", async () => {
    const h = await carriedPerformance(); expect(h.control.pick(h.actual.id, h.actual)).toBe(true);
    expect(h.control.completeCarriedPlay(h.actual.id, false)).toBe(false);
    expect(h.control.completeCarriedPlay(h.actual.id, true)).toBe(false);
    expect(h.onExperience).not.toHaveBeenCalled(); expect(h.node.getBoundingClientRect).not.toHaveBeenCalled();
  });
  it.each(["cancel", "pause", "put", "stash", "native-hold", "blocked"] as const)("revokes a carried performance after %s without inventing completed play", async boundary => {
    const h = await carriedPerformance(), { control, actual } = h; expect(control.pick(actual.id, actual)).toBe(true);
    if (boundary === "cancel") control.cancel(2000);
    if (boundary === "pause") control.pause(2000);
    if (boundary === "put") expect(control.put(actual.id, actual, 2000)).toBe(true);
    if (boundary === "stash") expect(control.stash(actual.id)).toBe(true);
    if (boundary === "native-hold") (h.button.props.onKeyDown as (event: unknown) => void)({ key: "Enter", preventDefault: vi.fn(), stopPropagation: vi.fn() });
    if (boundary === "blocked") h.render(true);
    expect(control.completeCarriedPlay(actual.id, true)).toBe(false);
    expect(h.onExperience.mock.calls.filter(([, outcome]) => outcome === "played")).toEqual([]);
  });
  it.each(["document-hidden", "detached", "node-hidden", "css-hidden", "transparent", "empty"] as const)("rejects a carried completion with %s actual presentation and cannot replay it after recovery", async boundary => {
    const h = await carriedPerformance(), { control, actual } = h; expect(control.pick(actual.id, actual)).toBe(true);
    if (boundary === "document-hidden") h.document.hidden = true;
    if (boundary === "detached") h.node.isConnected = false;
    if (boundary === "node-hidden") h.node.hidden = true;
    if (boundary === "css-hidden") h.style.visibility = "hidden";
    if (boundary === "transparent") h.style.opacity = "0";
    if (boundary === "empty") h.node.getBoundingClientRect.mockReturnValue({ left: 410, top: 330, width: 0, height: 44 });
    expect(control.completeCarriedPlay(actual.id, true)).toBe(false);
    h.document.hidden = h.node.hidden = false; h.node.isConnected = true; h.style.visibility = "visible"; h.style.opacity = "1";
    h.node.getBoundingClientRect.mockReturnValue({ left: 410, top: 330, width: 44, height: 44 });
    expect(control.completeCarriedPlay(actual.id, true)).toBe(false); expect(h.onExperience).not.toHaveBeenCalled();
  });
});
