import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCompanionToys, createCompanionToyPlanner, companionToyFoodPriority, COMPANION_TOY_KINDS, MAX_COMPANION_TOYS, type CompanionToy } from "@/lib/ui/viewer-companion/toys";
import { createBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const component = vi.hoisted(() => ({ refs: [] as { current: unknown }[], refIndex: 0, states: [] as unknown[], stateIndex: 0, effects: [] as (() => void)[], activity: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(),
  useRef: (initial: unknown) => component.refs[component.refIndex++] ?? (component.refs[component.refIndex - 1] = { current: initial }),
  useState: (initial: unknown) => { const index = component.stateIndex++; if (!(index in component.states)) component.states[index] = initial; return [component.states[index], (next: unknown) => { component.states[index] = typeof next === "function" ? next(component.states[index]) : next; }]; },
  useCallback: (callback: unknown) => callback,
  useEffect: (callback: () => void) => { component.effects.push(callback); },
  useImperativeHandle: (ref: { current: unknown }, create: () => unknown) => { ref.current = create(); }
}));
vi.mock("@/lib/activity/client", () => ({ logActivity: component.activity }));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

const bounds = { width: 1000, height: 700 };
const floor: Platform = { id: "floor", x: 0, y: 600, width: 1000, kind: "floor" };
const make = (platforms: readonly Platform[] = [floor]) => { const model = createCompanionToys(); model.sync(platforms, bounds, 0); return model; };
type Model = ReturnType<typeof createCompanionToys>;
const settle = (model: Model, start = 0) => { for (let at = start + 16; at <= start + 1800; at += 16) model.tick(at); };
const point = { x: 600, y: 500, platformId: floor.id };
function settled(model = make()) { const id = model.spawn(point, 0)!; settle(model); return { model, id, toy: model.available()[0] }; }
function context(personality: "tidy" | "mischievous" = "tidy", toys: readonly CompanionToy[] = []) {
  return { world: { x: 100, y: floor.y, platformId: floor.id, platforms: [floor], width: bounds.width, height: bounds.height, animated: true } as CompanionWorld,
    brain: { ...createBrain(0, () => .5), hunger: .1, energy: .9 }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality }, now: 2000, toys, count: toys.length, box: { x: 100, y: floor.y, platformId: floor.id } };
}

describe("real bounded companion toy objects", () => {
  it("spawns four different real objects, respects capacity and lands on the first crossed safe support", () => {
    const first = { ...floor, id: "first", y: 350 }, second = { ...floor, id: "second", y: 500 };
    const model = make([{ ...floor, id: "control", kind: "control", y: 250 }, { ...floor, id: "hidden", kind: "hide", y: 300 }, first, second, floor]);
    const ids = Array.from({ length: 5 }, () => model.spawn({ x: 600, y: 200 }, 0));
    expect(ids.slice(0, 4).every(Boolean)).toBe(true); expect(ids[4]).toBeUndefined();
    expect(model.items()).toHaveLength(MAX_COMPANION_TOYS); expect(model.items().map(toy => toy.kind)).toEqual(COMPANION_TOY_KINDS);
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

  it("falls onto a real lower replacement and removes a toy after two bounded unsupported recovery attempts", () => {
    const { model } = settled();
    const lower = { ...floor, id: "lower", y: 650 };
    model.sync([lower], bounds, 2000); expect(model.available()).toEqual([]);
    model.tick(2400); expect(model.items()[0]).toMatchObject({ platformId: lower.id, y: lower.y });
    model.sync([], bounds, 2500); model.tick(4600); model.tick(6700);
    expect(model.items()).toEqual([]); expect(model.moving()).toBe(false);
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
    expect(stashed).toBe(true); expect(model.items()).toEqual([]); expect(planner.active()).toBe(false);
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
  async function harness() {
    component.refs = []; component.states = []; component.activity.mockReset();
    vi.stubGlobal("React", await import("react")); vi.spyOn(performance, "now").mockReturnValue(2000);
    const { CompanionToys } = await import("@/components/poster/viewer-companion/companion-toys");
    const ref: { current: import("@/components/poster/viewer-companion/companion-toys").CompanionToyControl | null } = { current: null }, onActivity = vi.fn();
    const render = (blocked = false) => {
      component.refIndex = component.stateIndex = 0; component.effects = [];
      const tree = (CompanionToys as unknown as { render: (props: unknown, ref: unknown) => ReactElement }).render({ blocked, onActivity, onCount: vi.fn() }, ref);
      component.effects.forEach(effect => effect()); return tree;
    };
    render(); ref.current!.sync([floor], bounds, 0); ref.current!.spawn(point, 0);
    const tree = render(), button = (tree.props as { children: ReactElement[] }).children[0] as ReactElement<Record<string, unknown>>;
    return { ref, render, button, onActivity };
  }

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
    (h.button.props.onKeyDown as (event: unknown) => void)({ key: "Enter", preventDefault: vi.fn() });
    h.ref.current!.cancel(100); expect(h.ref.current!.moving()).toBe(false); expect(h.ref.current!.available()).toEqual([]);
    h.render(true); h.ref.current!.tick(20000); expect(h.ref.current!.moving()).toBe(false);
    vi.mocked(performance.now).mockReturnValue(20000); h.render(false); expect(h.ref.current!.moving()).toBe(true);
    expect(component.activity.mock.calls).toEqual([["ui.click", { target: "companion-toy-grab" }]]);
  });

  it("keyboard arrows take native priority once, repeated motion adds no fake grab and Escape records only the successful drop", async () => {
    const h = await harness(); h.onActivity.mockClear();
    const press = (key: string) => (h.button.props.onKeyDown as (event: unknown) => void)({ key, preventDefault: vi.fn() });
    press("ArrowRight"); press("ArrowDown");
    expect(h.onActivity.mock.calls).toEqual([[true], [true]]);
    expect(component.activity.mock.calls).toEqual([["ui.click", { target: "companion-toy-grab" }]]);
    h.ref.current!.cancel(2000); expect(h.ref.current!.moving()).toBe(false);
    press("Escape"); press("Escape");
    expect(component.activity.mock.calls).toEqual([["ui.click", { target: "companion-toy-grab" }], ["ui.click", { target: "companion-toy-drop" }]]);
    expect(h.onActivity.mock.calls).toEqual([[true], [true], [true]]); expect(h.ref.current!.moving()).toBe(true);
  });
});
