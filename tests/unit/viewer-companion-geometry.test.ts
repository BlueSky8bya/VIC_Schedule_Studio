import { afterEach, describe, expect, it, vi } from "vitest";
import { createCompanionGeometryIdentity, observeCompanionPlatforms, safeCompanionSurfaces, unoccludedCompanionRects, type CompanionSurface, type CompanionTextRect, type CompanionGeometrySubscription, type CompanionFollowSample } from "@/lib/ui/viewer-companion/geometry";
import type { Platform } from "@/lib/ui/viewer-companion/brain";

const viewport = { width: 1000, height: 800 };
const text = (left: number, top: number, right: number, bottom: number): CompanionTextRect => ({ left, top, right, bottom });
const safe = (surface: CompanionSurface, obstacles: CompanionTextRect[], size = 76) => safeCompanionSurfaces(surface, obstacles, size, viewport);

function expectClear(surfaces: CompanionSurface[], obstacles: CompanionTextRect[], size: number) {
  for (const surface of surfaces) for (let step = 0; step <= 10; step++) {
    const centre = surface.x + surface.width * step / 10;
    const body = { left: centre - size / 2, right: centre + size / 2, top: surface.y - size, bottom: surface.y };
    for (const rect of obstacles) {
      const overlaps = body.left < rect.right && body.right > rect.left && body.top < rect.bottom && body.bottom > rect.top;
      expect(overlaps, `body at ${centre},${surface.y} overlaps a text rectangle`).toBe(false);
    }
  }
}

const box = (left: number, top: number, width: number, height: number) => ({ left, top, right: left + width, bottom: top + height, width, height, x: left, y: top, toJSON: () => ({ left, top, width, height }) }) as DOMRect;
class FixtureEvents {
  listeners = new Map<string, Set<() => void>>();
  addEventListener = (type: string, callback: () => void) => { const set = this.listeners.get(type) ?? new Set(); set.add(callback); this.listeners.set(type, set); };
  removeEventListener = (type: string, callback: () => void) => { this.listeners.get(type)?.delete(callback); };
  emit(type: string) { for (const callback of this.listeners.get(type) ?? []) callback(); }
  count() { return [...this.listeners.values()].reduce((count, set) => count + set.size, 0); }
}
class FixtureElement extends FixtureEvents {
  isConnected = true;
  parentElement: FixtureElement | null = null;
  rect = box(0, 0, 1000, 800);
  getBoundingClientRect = vi.fn(() => this.rect);
  hasAttribute: (name: string) => boolean = () => false;
  getAttribute = () => null;
  querySelector: (selector: string) => FixtureElement | null = () => null;
  querySelectorAll: (selector: string) => FixtureElement[] = () => [];
  closest: (selector: string) => FixtureElement | null = () => null;
  matches: (selector: string) => boolean = () => false;
  contains(node: FixtureElement | null): boolean { return node === this || Boolean(node?.parentElement && this.contains(node.parentElement)); }
}
function geometryFixture() {
  let now = 0, serial = 0;
  const frames = new Map<number, FrameRequestCallback>(), timers = new Map<number, { at: number; callback: () => void }>();
  const viewportEvents = new FixtureEvents(), fontEvents = new FixtureEvents();
  const style = { display: "block", visibility: "visible", opacity: "1", overflowX: "visible", overflowY: "visible", position: "static" };
  const win = Object.assign(new FixtureEvents(), {
    innerWidth: 1000, innerHeight: 800, visualViewport: viewportEvents, performance: { now: () => now },
    getComputedStyle: vi.fn(() => style),
    requestAnimationFrame: (callback: FrameRequestCallback) => { const id = ++serial; frames.set(id, callback); return id; },
    cancelAnimationFrame: vi.fn((id: number) => { frames.delete(id); }),
    setTimeout: (callback: () => void, delay: number) => { const id = ++serial; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout: vi.fn((id: number) => { timers.delete(id); }),
  });
  const observers: { disconnect: ReturnType<typeof vi.fn>; observe: ReturnType<typeof vi.fn> }[] = [];
  class FixtureObserver {
    disconnect = vi.fn(); observe = vi.fn(); unobserve = vi.fn();
    constructor() { observers.push(this); }
  }
  vi.stubGlobal("MutationObserver", FixtureObserver); vi.stubGlobal("ResizeObserver", FixtureObserver); vi.stubGlobal("NodeFilter", { SHOW_TEXT: 4 });
  const root = new FixtureElement(), day = new FixtureElement(), date = new FixtureElement(), card = new FixtureElement(), title = new FixtureElement(), heart = new FixtureElement(), home = new FixtureElement();
  day.parentElement = root; date.parentElement = day; card.parentElement = root; title.parentElement = card; heart.parentElement = card;
  date.rect = box(200, 300, 100, 20); title.rect = box(500, 450, 200, 20); home.rect = box(200, 600, 120, 14); heart.rect = box(720, 450, 20, 20);
  date.closest = selector => selector.includes(".day-strip") ? date : selector === ".public-day,.agenda-day" ? day : null;
  date.matches = selector => selector.includes(".day-strip");
  title.closest = selector => selector.includes(".event-main") ? title : selector.includes("data-eventid") ? card : null;
  card.querySelector = selector => selector === ".event-heart" ? heart : null;
  const controls: FixtureElement[] = [];
  root.querySelectorAll = selector => selector.includes("data-eventid") ? [card] : selector === ".public-day,.agenda-day" ? [day] : selector.startsWith("button,") ? controls : [];
  const nodes = [{ parentElement: date }, { parentElement: title }];
  const range = { current: nodes[0], selectNodeContents(node: typeof nodes[number]) { this.current = node; }, getClientRects: vi.fn(function (this: { current: typeof nodes[number] }) { return [this.current.parentElement.rect]; }), detach() {} };
  Object.assign(root, { ownerDocument: {
    defaultView: win, fonts: fontEvents, querySelectorAll: () => [],
    createTreeWalker: () => { let index = 0; return { nextNode: () => nodes[index++] ?? null }; },
    createRange: () => range,
  } });
  const flush = () => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(now); };
  const advance = (elapsed: number) => { now += elapsed; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); } flush(); };
  return { root: root as unknown as HTMLElement, sourceRoot: root, card, date, title, home, heart, controls, win, viewportEvents, fontEvents, observers, range, frames, timers, flush, advance };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("companion geometry anchor subscription", () => {
  it("offers real card tops plus real floor/home for deliberate drops, excluding glyph ledges", () => {
    const fixture = geometryFixture(); fixture.card.rect = box(470, 430, 260, 60);
    const subscription = observeCompanionPlatforms(fixture.root, () => {}, { home: fixture.home as unknown as HTMLElement });
    fixture.flush();
    const landings = subscription.landings(), card = landings.find(p => p.id.includes("-top"))!;
    expect(card).toMatchObject({ x: 470, y: 427, width: 260, kind: "card", manualOnly: true });
    expect(landings.some(p => p.kind === "floor")).toBe(true); expect(landings.some(p => p.id === "companion-home")).toBe(true);
    expect(landings.every(p => p.kind === "floor" || p.id === "companion-home" || p.id.includes("-top"))).toBe(true);
    expect(subscription.anchor(card.id)).toEqual({ element: fixture.card, left: 470, top: 430 });
    const ranges = fixture.range.getClientRects.mock.calls.length;
    fixture.card.rect = box(480, 450, 260, 60);
    expect(subscription.follow([card.id])[0]).toMatchObject({ platform: { x: 480, y: 447 }, anchorX: 480, anchorY: 450 });
    expect(fixture.range.getClientRects).toHaveBeenCalledTimes(ranges);
    subscription();
  });
  it("keeps a first card in dense text while still excluding real control hit targets", () => {
    const fixture = geometryFixture(); fixture.card.rect = box(470, 430, 260, 60); fixture.date.rect = box(500, 400, 200, 20);
    let roaming: Platform[] = [];
    const subscription = observeCompanionPlatforms(fixture.root, next => { roaming = next; }); fixture.flush();
    const covers = (p: Platform, x: number) => x >= p.x && x <= p.x + p.width;
    expect(subscription.landings().some(p => p.id.includes("-top") && covers(p, 600))).toBe(true);
    expect(roaming.some(p => p.kind === "card" && covers(p, 600))).toBe(false);
    const control = new FixtureElement(); control.parentElement = fixture.sourceRoot; control.rect = box(580, 400, 40, 40); fixture.controls.push(control);
    fixture.win.emit("resize"); fixture.advance(120);
    expect(subscription.landings().some(p => p.id.includes("-top") && covers(p, 600))).toBe(false);
    expect(subscription.landings().some(p => p.id.includes("-top"))).toBe(true);
    subscription();
  });
  it("publishes a changed card-top baseline even when glyph geometry is unchanged", () => {
    const fixture = geometryFixture(); fixture.card.rect = box(470, 430, 260, 60);
    let deliveries = 0, latest: readonly Platform[] = [];
    const subscription = observeCompanionPlatforms(fixture.root, () => { deliveries++; latest = subscription.landings(); });
    fixture.flush(); const card = latest.find(p => p.id.includes("-top"))!;
    card.x = -10000;
    expect(subscription.landings().find(p => p.id === card.id)?.x).toBe(470);
    fixture.card.rect = box(480, 440, 260, 60); fixture.win.emit("resize"); fixture.advance(120);
    expect(deliveries).toBe(2); expect(latest.find(p => p.id === card.id)).toMatchObject({ x: 480, y: 437 });
    expect(subscription.anchor(card.id)).toEqual({ element: fixture.card, left: 480, top: 440 });
    subscription();
  });
  it("does not invent a visible landing through a hidden card or full control cover", () => {
    const fixture = geometryFixture(); fixture.card.rect = box(470, 430, 260, 60);
    fixture.card.hasAttribute = name => name === "hidden";
    const subscription = observeCompanionPlatforms(fixture.root, () => {}); fixture.flush();
    expect(subscription.landings().some(p => p.id.includes("-top"))).toBe(false);
    const control = new FixtureElement(); control.parentElement = fixture.sourceRoot; control.rect = box(0, 0, 1000, 800); fixture.controls.push(control);
    fixture.win.emit("resize"); fixture.advance(120);
    expect(subscription.landings()).toEqual([]);
    fixture.sourceRoot.isConnected = false; fixture.win.emit("resize"); fixture.advance(120);
    expect(subscription.landings()).toEqual([]);
    subscription();
  });
  it("keeps a low first card for32px fruit even when the92px creature cannot fit", () => {
    const fixture = geometryFixture(); fixture.card.rect = box(100, 62, 90, 30);
    const subscription = observeCompanionPlatforms(fixture.root, () => {}, { size: 92 }); fixture.flush();
    expect(subscription.landings().some(p => p.id.includes("-top"))).toBe(false);
    const food = subscription.landings(32).find(p => p.id.includes("-food-top"))!;
    expect(food).toMatchObject({ x: 100, y: 59, width: 90, manualOnly: true });
    expect(subscription.anchor(food.id)).toEqual({ element: fixture.card, left: 100, top: 62 });
    const rects = fixture.card.getBoundingClientRect.mock.calls.length, ranges = fixture.range.getClientRects.mock.calls.length;
    subscription.landings(32); subscription.landings(); subscription.anchor(food.id);
    expect(fixture.card.getBoundingClientRect).toHaveBeenCalledTimes(rects); expect(fixture.range.getClientRects).toHaveBeenCalledTimes(ranges);
    subscription();
  });
  it("keeps food and pet spans on separate paired baselines at narrow viewport edges", () => {
    const fixture = geometryFixture(); fixture.card.rect = box(12, 430, 70, 60);
    const subscription = observeCompanionPlatforms(fixture.root, () => {}, { size: 92 }); fixture.flush();
    const pet = subscription.landings().find(p => p.id.includes("-top"))!, food = subscription.landings(32).find(p => p.id.includes("-food-top"))!;
    expect(pet.x).toBe(50); expect(food.x).toBe(26); expect(food.id).not.toBe(pet.id);
    fixture.card.rect = box(22, 450, 70, 60); fixture.card.getBoundingClientRect.mockClear();
    const followed = subscription.follow([pet.id, food.id]);
    expect(followed[0].platform).toMatchObject({ id: pet.id, x: 60, y: 447 });
    expect(followed[1].platform).toMatchObject({ id: food.id, x: 36, y: 447 });
    expect(fixture.card.getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(subscription.landings().find(p => p.id === pet.id)?.x).toBe(50);
    expect(subscription.landings(32).find(p => p.id === food.id)?.x).toBe(26);
    subscription();
  });
  it("computes real home and floor food supports independently of the larger pet clearance", () => {
    const fixture = geometryFixture(); fixture.home.rect = box(200, 62, 120, 2);
    const control = new FixtureElement(); control.parentElement = fixture.sourceRoot; control.rect = box(0, 680, 1000, 40); fixture.controls.push(control);
    const subscription = observeCompanionPlatforms(fixture.root, () => {}, { size: 92, home: fixture.home as unknown as HTMLElement }); fixture.flush();
    expect(subscription.landings().some(p => p.id === "companion-home" || p.kind === "floor")).toBe(false);
    expect(subscription.landings(32).some(p => p.id === "companion-home-food" && p.y === 62)).toBe(true);
    expect(subscription.landings(32).some(p => p.id === "viewport-floor-food" && p.y === 782)).toBe(true);
    subscription();
  });
  it("publishes food-only geometry changes and retains full control protection at the food tier", () => {
    const fixture = geometryFixture(); fixture.card.rect = box(100, 62, 90, 30);
    const changed = vi.fn(), subscription = observeCompanionPlatforms(fixture.root, changed, { size: 92 }); fixture.flush();
    fixture.card.rect = box(110, 62, 90, 30); fixture.win.emit("resize"); fixture.advance(120);
    expect(changed).toHaveBeenCalledTimes(2);
    const control = new FixtureElement(); control.parentElement = fixture.sourceRoot; control.rect = box(130, 35, 40, 40); fixture.controls.push(control);
    fixture.win.emit("resize"); fixture.advance(120);
    expect(subscription.landings(32).some(p => p.id.includes("-food-top") && p.x <= 150 && p.x + p.width >= 150)).toBe(false);
    fixture.sourceRoot.isConnected = false; subscription.follow([]);
    expect(subscription.landings(32)).toEqual([]); expect(subscription.landings()).toEqual([]);
    subscription();
  });
  it("keeps anonymous anchor identities across an observer sleep and reconnect", () => {
    const fixture = geometryFixture(), identity = createCompanionGeometryIdentity();
    let first: Platform[] = [], second: Platform[] = [];
    const subscription = observeCompanionPlatforms(fixture.root, platforms => { first = platforms; }, { identity });
    fixture.flush(); subscription();
    const reconnect = observeCompanionPlatforms(fixture.root, platforms => { second = platforms; }, { identity });
    fixture.flush(); reconnect();
    expect(first.map(platform => platform.id)).toEqual(second.map(platform => platform.id));
    expect(identity.serial).toBe(2);
    expect(identity.ids.get(fixture.date as unknown as Element)).toBe("date-1");
  });

  it("follows only two actual anchors with absolute deltas, including heart coordinates", () => {
    const fixture = geometryFixture(); let platforms: Platform[] = [];
    const subscription = observeCompanionPlatforms(fixture.root, next => { platforms = next; }, { home: fixture.home as unknown as HTMLElement });
    fixture.flush();
    const source = platforms.find(platform => platform.kind === "card")!;
    fixture.title.rect = box(525, 410, 200, 20); fixture.home.rect = box(210, 620, 120, 14);
    const rangeCalls = fixture.range.getClientRects.mock.calls.length, styleCalls = fixture.win.getComputedStyle.mock.calls.length;
    fixture.title.getBoundingClientRect.mockClear(); fixture.home.getBoundingClientRect.mockClear(); fixture.date.getBoundingClientRect.mockClear();
    const result = subscription.follow([source.id, "companion-home", "date-1"]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ platform: { ...source, x: source.x + 25, y: source.y - 40, heart: { ...source.heart!, x: source.heart!.x + 25, y: source.heart!.y - 40 } }, anchorX: 525, anchorY: 410 });
    expect(result[1]).toMatchObject({ platform: { id: "companion-home", x: 210, y: 620 }, anchorX: 210, anchorY: 620 });
    expect(fixture.title.getBoundingClientRect).toHaveBeenCalledTimes(1); expect(fixture.home.getBoundingClientRect).toHaveBeenCalledTimes(1); expect(fixture.date.getBoundingClientRect).not.toHaveBeenCalled();
    expect(fixture.range.getClientRects).toHaveBeenCalledTimes(rangeCalls); expect(fixture.win.getComputedStyle).toHaveBeenCalledTimes(styleCalls);
    expect(subscription.follow([source.id])[0]).toEqual(result[0]);
    source.x = -10000; source.heart!.x = -10000;
    expect(subscription.follow([source.id])[0]).toEqual(result[0]);
    subscription();
  });

  it("publishes a fresh baseline before onChange, avoiding a second scroll delta", () => {
    const fixture = geometryFixture(); let delivered: Platform[] = [], followed: CompanionFollowSample[] = [];
    const subscription: CompanionGeometrySubscription = observeCompanionPlatforms(fixture.root, next => { delivered = next; followed = subscription.follow(["date-1"]); });
    fixture.flush(); fixture.date.rect = box(215, 340, 100, 20);
    fixture.win.emit("scroll"); fixture.advance(120);
    expect(followed[0].platform).toEqual(delivered.find(platform => platform.id === "date-1"));
    expect(followed[0]).toMatchObject({ platform: { x: 215, y: 337 }, anchorX: 215, anchorY: 340 });
    fixture.date.rect = box(220, 345, 100, 20);
    expect(subscription.follow(["date-1"])[0]).toMatchObject({ platform: { x: 220, y: 342 }, anchorX: 220, anchorY: 345 });
    subscription();
  });

  it("retains read-only following after unsubscribe but rejects missing or disconnected anchors", () => {
    const fixture = geometryFixture(); let platforms: Platform[] = [];
    const subscription = observeCompanionPlatforms(fixture.root, next => { platforms = next; }); fixture.flush();
    const floor = platforms.find(platform => platform.kind === "floor")!;
    subscription(); fixture.date.rect = box(210, 320, 100, 20);
    expect(subscription.follow(["date-1"])[0]).toMatchObject({ platform: { x: 210, y: 317 }, anchorX: 210, anchorY: 320 });
    expect(subscription.follow([floor.id])[0]).toEqual({ platform: floor, anchorX: 0, anchorY: 0 });
    fixture.date.isConnected = false;
    expect(subscription.follow(["date-1", "missing"])).toEqual([]);
    fixture.date.isConnected = true; fixture.date.rect = box(0, 0, 0, 0);
    expect(subscription.follow(["date-1"])).toEqual([]);
    fixture.sourceRoot.isConnected = false;
    expect(subscription.follow([floor.id])).toEqual([]);
  });

  it("distinguishes safe-span reclipping from movement of the actual anchor", () => {
    const fixture = geometryFixture(); let platforms: Platform[] = [];
    const subscription = observeCompanionPlatforms(fixture.root, next => { platforms = next; }); fixture.flush();
    const id = platforms.find(platform => platform.kind === "card")!.id;
    const before = subscription.follow([id])[0];
    const control = new FixtureElement(); control.parentElement = fixture.sourceRoot; control.rect = box(450, 400, 100, 40); fixture.controls.push(control);
    fixture.win.emit("resize"); fixture.advance(120);
    const after = subscription.follow([id])[0];
    expect(after.platform.x).toBeGreaterThan(before.platform.x + 80);
    expect(after.anchorX - before.anchorX).toBe(0); expect(after.anchorY - before.anchorY).toBe(0);
    expect(after.platform).toEqual(platforms.find(platform => platform.id === id));
    subscription();
  });

  it("retains a followed flight source outside safe clipping without making it a landing surface", () => {
    const fixture = geometryFixture(); let platforms: Platform[] = [], inCallback: CompanionFollowSample[] = [];
    const subscription: CompanionGeometrySubscription = observeCompanionPlatforms(fixture.root, next => { platforms = next; inCallback = subscription.follow(["date-1", "card-2"]); });
    fixture.flush();
    const initial = subscription.follow(["date-1"])[0];
    fixture.date.rect = box(200, 30, 100, 20);
    fixture.win.emit("scroll"); fixture.advance(120);
    expect(platforms.some(platform => platform.id === "date-1")).toBe(false);
    expect(inCallback.find(sample => sample.platform.id === "date-1")).toMatchObject({ platform: { x: initial.platform.x, y: 27 }, anchorX: 200, anchorY: 30 });
    fixture.date.rect = box(205, 10, 100, 20);
    const rangeCalls = fixture.range.getClientRects.mock.calls.length;
    expect(subscription.follow(["date-1"])[0]).toMatchObject({ platform: { x: initial.platform.x + 5, y: 7 }, anchorX: 205, anchorY: 10 });
    expect(fixture.range.getClientRects).toHaveBeenCalledTimes(rangeCalls);
    subscription(); fixture.date.rect = box(205, -10, 100, 20);
    expect(subscription.follow(["date-1"])[0]).toMatchObject({ anchorX: 205, anchorY: -10 });
  });

  it("releases retained snapshots on a new followed pair, source deletion, and root removal", () => {
    const fixture = geometryFixture(); let platforms: Platform[] = [];
    const subscription = observeCompanionPlatforms(fixture.root, next => { platforms = next; }); fixture.flush();
    subscription.follow(["date-1", "card-2"]);
    fixture.date.rect = box(200, 30, 100, 20); fixture.title.rect = box(500, 30, 200, 20);
    fixture.win.emit("scroll"); fixture.advance(120);
    expect(platforms.every(platform => platform.kind === "floor")).toBe(true);
    expect(subscription.follow(["date-1", "card-2"])).toHaveLength(2);
    subscription.follow(["card-2"]);
    expect(subscription.follow(["date-1", "card-2"])).toHaveLength(1);
    fixture.title.isConnected = false;
    expect(subscription.follow(["card-2"])).toEqual([]);
    fixture.title.isConnected = true;
    expect(subscription.follow(["card-2"])).toEqual([]);
    const floor = platforms[0];
    expect(subscription.follow([floor.id])).toHaveLength(1);
    fixture.sourceRoot.isConnected = false;
    expect(subscription.follow([floor.id])).toEqual([]);
    fixture.sourceRoot.isConnected = true;
    expect(subscription.follow([floor.id])).toEqual([]);
    subscription();
  });

  it("coalesces scrollend and visual-viewport events and removes every scheduled callback on cleanup", () => {
    const fixture = geometryFixture(), onChange = vi.fn();
    const subscription = observeCompanionPlatforms(fixture.root, onChange); fixture.flush();
    fixture.date.rect = box(200, 310, 100, 20);
    fixture.win.emit("scrollend"); fixture.viewportEvents.emit("scroll"); fixture.viewportEvents.emit("resize");
    expect(fixture.timers.size).toBe(1);
    fixture.advance(120); expect(onChange).toHaveBeenCalledTimes(2);
    fixture.viewportEvents.emit("resize"); expect(fixture.timers.size).toBe(1);
    subscription(); subscription();
    expect(fixture.timers.size).toBe(0); expect(fixture.frames.size).toBe(0);
    expect(fixture.win.count()).toBe(0); expect(fixture.viewportEvents.count()).toBe(0); expect(fixture.fontEvents.count()).toBe(0);
    for (const observer of fixture.observers) expect(observer.disconnect).toHaveBeenCalledTimes(1);
    fixture.win.emit("scrollend"); fixture.viewportEvents.emit("resize"); fixture.advance(1000);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("offers an inert callable follow handle when a capture has no browsing window", () => {
    const subscription = observeCompanionPlatforms({ ownerDocument: { defaultView: null } } as unknown as HTMLElement, vi.fn());
    expect(subscription.follow(["anything"])).toEqual([]); expect(() => subscription()).not.toThrow();
  });

  it("cancels an initial frame before any measurement can outlive its owner", () => {
    const fixture = geometryFixture(), onChange = vi.fn();
    const subscription = observeCompanionPlatforms(fixture.root, onChange);
    expect(fixture.frames.size).toBe(1); subscription(); fixture.flush();
    expect(onChange).not.toHaveBeenCalled(); expect(fixture.frames.size).toBe(0);
    expect(subscription.follow(["date-1"])).toEqual([]);
  });
});

describe("companion text platforms", () => {
  it("uses the registered opaque body while retaining full-cell viewport bounds", () => {
    const obstacles = [text(20, 500, 40, 516), text(85, 530, 330, 548)];
    const surfaces = safeCompanionSurfaces({ x: 42, y: 580, width: 300 }, obstacles, 76, viewport, { width: 57.76, height: 57.76 });
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0]).toMatchObject({ x: 42, y: 580 });
    expect(surfaces[0].width).toBeCloseTo(11.12);
    for (const surface of surfaces) {
      expect(surface.x).toBeGreaterThanOrEqual(42);
      for (const centre of [surface.x, surface.x + surface.width]) for (const rect of obstacles) {
        expect(centre - 28.88 < rect.right && centre + 28.88 > rect.left && surface.y - 57.76 < rect.bottom && surface.y > rect.top).toBe(false);
      }
    }
    expect(safeCompanionSurfaces({ x: 42, y: 580, width: 300 }, obstacles, 76, viewport)).toEqual([]);
  });

  it("ignores calendar ink hidden behind the opaque house while retaining its own labels", () => {
    const house = text(60, 400, 365, 800);
    const coveredCalendar = text(75, 486, 205, 503);
    const ownLabel = text(250, 490, 290, 510);
    const obstacles = [...unoccludedCompanionRects(coveredCalendar, house), ...unoccludedCompanionRects(ownLabel)];
    const surfaces = safe({ x: 108, y: 535, width: 118 }, obstacles);
    expect(surfaces).toEqual([{ x: 108, y: 535, width: 101 }]);
    expectClear(surfaces, [ownLabel], 76);
  });

  it("preserves the visible part of a calendar line outside the house", () => {
    const fragments = unoccludedCompanionRects(text(40, 480, 120, 500), text(60, 400, 365, 800));
    expect(fragments).toEqual([text(40, 480, 60, 500)]);
    const surfaces = safe({ x: 80, y: 535, width: 150 }, fragments);
    expect(surfaces).toEqual([{ x: 101, y: 535, width: 129 }]);
    expectClear(surfaces, fragments, 76);
  });

  it("clips all four exposed sides without counting the hidden centre", () => {
    const parts = unoccludedCompanionRects(text(100, 100, 300, 300), text(150, 150, 250, 250));
    expect(parts).toEqual([text(100, 100, 300, 150), text(100, 250, 300, 300), text(100, 150, 150, 250), text(250, 150, 300, 250)]);
    expect(parts.reduce((area, rect) => area + (rect.right - rect.left) * (rect.bottom - rect.top), 0)).toBe(30000);
    expect(unoccludedCompanionRects(text(100, 100, 150, 150), text(150, 100, 200, 200))).toEqual([text(100, 100, 150, 150)]);
  });

  it("protects a full icon-only hit target, including its empty padding", () => {
    const control = text(400, 700, 448, 748);
    const surfaces = safe({ x: 200, y: 760, width: 500 }, [control]);
    expect(surfaces).toEqual([{ x: 200, y: 760, width: 159 }, { x: 489, y: 760, width: 211 }]);
    expectClear(surfaces, [control], 76);
  });

  it("stands above the actual supporting line, without using a padded card top", () => {
    const supporting = text(200, 300, 420, 320);
    const surfaces = safe({ x: supporting.left, y: supporting.top - 3, width: supporting.right - supporting.left }, [supporting]);
    expect(surfaces).toEqual([{ x: 200, y: 297, width: 220 }]);
    expectClear(surfaces, [supporting], 76);
  });

  it("removes the part of a title ledge whose body would cover the date above", () => {
    const date = text(180, 225, 210, 250);
    const title = text(180, 300, 450, 322);
    const surfaces = safe({ x: 180, y: 297, width: 270 }, [date, title]);
    expect(surfaces).toEqual([{ x: 251, y: 297, width: 199 }]);
    expectClear(surfaces, [date, title], 76);
  });

  it("splits a wide ledge around text in the neighbouring date cell", () => {
    const obstacles = [text(410, 400, 480, 422), text(680, 380, 740, 405)];
    const surfaces = safe({ x: 150, y: 450, width: 730 }, obstacles);
    expect(surfaces).toEqual([{ x: 150, y: 450, width: 219 }, { x: 521, y: 450, width: 118 }, { x: 781, y: 450, width: 99 }]);
    expectClear(surfaces, obstacles, 76);
  });

  it("rejects a subtitle when the title above fills every possible centre", () => {
    const title = text(200, 250, 450, 276);
    expect(safe({ x: 220, y: 290, width: 180 }, [title])).toEqual([]);
  });

  it("keeps a narrow date number as a valid ledge when its full body has room", () => {
    const date = text(500, 210, 511, 233);
    const surfaces = safe({ x: 500, y: 207, width: 11 }, [date]);
    expect(surfaces).toEqual([{ x: 500, y: 207, width: 11 }]);
    expectClear(surfaces, [date], 76);
  });

  it("uses the current sprite size and viewport pixels after scaling or resizing", () => {
    const obstacle = text(400, 300, 460, 320);
    const surface = { x: 300, y: 350, width: 300 };
    for (const size of [60, 76, 92]) {
      const surfaces = safe(surface, [obstacle], size);
      expectClear(surfaces, [obstacle], size);
      expect(surfaces[0].width).toBe(400 - size / 2 - 3 - 300);
    }
    const scaled = safeCompanionSurfaces({ x: 150, y: 175, width: 150 }, [text(200, 150, 230, 160)], 76, { width: 500, height: 400 });
    expectClear(scaled, [text(200, 150, 230, 160)], 76);
    expect(scaled).toEqual([{ x: 150, y: 175, width: 9 }, { x: 271, y: 175, width: 29 }]);
  });

  it("keeps body bounds inside the viewport, including the floor", () => {
    expect(safe({ x: 0, y: 782, width: 1000 }, [])).toEqual([{ x: 42, y: 782, width: 916 }]);
    expect(safe({ x: 0, y: 60, width: 1000 }, [])).toEqual([]);
    expect(safe({ x: 0, y: 795, width: 1000 }, [])).toEqual([]);
    expect(safeCompanionSurfaces({ x: 0, y: 200, width: 50 }, [], 76, { width: 50, height: 300 })).toEqual([]);
  });

  it("keeps the complete44x38 food input target visible around its32px drawing", () => {
    const footprint = { width: 44, height: 38 };
    const food = (y: number, width = viewport.width) => safeCompanionSurfaces({ x: 0, y, width }, [], 32, { ...viewport, width }, footprint);
    expect(food(40)).toEqual([]);
    const spans = food(41);
    expect(spans).toEqual([{ x: 26, y: 41, width: 948 }]);
    for (const span of spans) for (const x of [span.x, span.x + span.width]) {
      expect(x - footprint.width / 2).toBeGreaterThanOrEqual(4);
      expect(x + footprint.width / 2).toBeLessThanOrEqual(viewport.width - 4);
      expect(span.y - footprint.height).toBeGreaterThanOrEqual(3);
    }
    // A32px image alone fits here; its real native target does not.
    expect(food(100, 50)).toEqual([]);
  });

  it("removes a floor segment beneath visible controls instead of obscuring their labels", () => {
    const controls = [text(430, 730, 570, 751)];
    const surfaces = safe({ x: 12, y: 782, width: 976 }, controls);
    expect(surfaces).toEqual([{ x: 42, y: 782, width: 347 }, { x: 611, y: 782, width: 347 }]);
    expectClear(surfaces, controls, 76);
  });

  it("allows a cushion only where the pet clears the house's own labels", () => {
    const labels = [text(200, 300, 290, 323)];
    const surfaces = safe({ x: 200, y: 370, width: 240 }, labels);
    expect(surfaces).toEqual([{ x: 331, y: 370, width: 109 }]);
    expectClear(surfaces, labels, 76);
  });

  it("is independent of obstacle order and safely ignores invalid rectangles", () => {
    const surface = { x: 100, y: 500, width: 800 };
    const obstacles = [text(300, 450, 360, 480), text(500, 440, 550, 460), text(0, 100, 900, 120)];
    expect(safe(surface, obstacles)).toEqual(safe(surface, [...obstacles].reverse()));
    expect(safe(surface, [text(NaN, 400, 500, 430), text(200, 400, 200, 430)])).toEqual(safe(surface, []));
    expect(safe({ x: NaN, y: 400, width: 300 }, [])).toEqual([]);
    expect(safe(surface, [], NaN)).toEqual([]);
  });
});
