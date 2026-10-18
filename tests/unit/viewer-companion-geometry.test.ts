import { afterEach, describe, expect, it, vi } from "vitest";
import { createCompanionGeometryIdentity, observeCompanionPlatforms, safeCompanionSurfaces, unoccludedCompanionRects, type CompanionSurface, type CompanionTextRect, type CompanionGeometrySubscription, type CompanionFollowSample } from "@/lib/ui/viewer-companion/geometry";
import type { Platform } from "@/lib/ui/viewer-companion/brain";
import { COMPANION_HOME_FLOOR_FOOD, placeCompanionFood, type CompanionFoodDropSupport } from "@/lib/ui/viewer-companion/food";
import { COMPANION_PANEL_SIDE_SELECTOR } from "@/lib/ui/viewer-companion/panel-play";

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
  getAttribute: (name: string) => string | null = () => null;
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
    getComputedStyle: vi.fn<(element?: unknown) => typeof style>(() => style),
    requestAnimationFrame: (callback: FrameRequestCallback) => { const id = ++serial; frames.set(id, callback); return id; },
    cancelAnimationFrame: vi.fn((id: number) => { frames.delete(id); }),
    setTimeout: (callback: () => void, delay: number) => { const id = ++serial; timers.set(id, { at: now + delay, callback }); return id; },
    clearTimeout: vi.fn((id: number) => { timers.delete(id); }),
  });
  const observers: { disconnect: ReturnType<typeof vi.fn>; observe: ReturnType<typeof vi.fn> }[] = [];
  const callbacks: ((records: readonly MutationRecord[]) => void)[] = [];
  class FixtureObserver {
    disconnect = vi.fn(); observe = vi.fn(); unobserve = vi.fn();
    constructor(callback: (records: readonly MutationRecord[]) => void) { observers.push(this); callbacks.push(callback); }
  }
  vi.stubGlobal("MutationObserver", FixtureObserver); vi.stubGlobal("ResizeObserver", FixtureObserver); vi.stubGlobal("NodeFilter", { SHOW_TEXT: 4 });
  const root = new FixtureElement(), day = new FixtureElement(), date = new FixtureElement(), card = new FixtureElement(), title = new FixtureElement(), heart = new FixtureElement(), home = new FixtureElement();
  day.parentElement = root; date.parentElement = day; card.parentElement = root; title.parentElement = card; heart.parentElement = card;
  date.rect = box(200, 300, 100, 20); title.rect = box(500, 450, 200, 20); home.rect = box(200, 600, 120, 14); heart.rect = box(720, 450, 20, 20);
  date.closest = selector => selector.includes(".day-strip") ? date : selector.includes(".public-day") ? day : null;
  date.matches = selector => selector.includes(".day-strip");
  title.closest = selector => selector.includes(".event-main") ? title : selector.includes("data-eventid") ? card : null;
  card.querySelector = selector => selector === ".event-heart" ? heart : null;
  const controls: FixtureElement[] = [];
  root.querySelectorAll = selector => selector.includes("data-eventid") ? [card] : selector.startsWith(".public-day") ? [day] : selector.startsWith("button,") ? controls : [];
  const nodes = [{ parentElement: date }, { parentElement: title }];
  const range = { current: nodes[0], selectNodeContents(node: typeof nodes[number]) { this.current = node; }, getClientRects: vi.fn(function (this: { current: typeof nodes[number] }) { return [this.current.parentElement.rect]; }), detach() {} };
  Object.assign(root, { ownerDocument: {
    defaultView: win, fonts: fontEvents, querySelectorAll: () => [],
    createTreeWalker: () => { let index = 0; return { nextNode: () => nodes[index++] ?? null }; },
    createRange: () => range,
  } });
  const flush = () => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(now); };
  const advance = (elapsed: number) => { now += elapsed; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.callback(); } flush(); };
  return { root: root as unknown as HTMLElement, sourceRoot: root, day, card, date, title, home, heart, controls, win, viewportEvents, fontEvents, observers, callbacks, range, frames, timers, flush, advance };
}

describe("111 text geometry reuse", () => {
  it("translates cached lines on scroll, reranges only changed text and invalidates fonts", () => {
    const f = geometryFixture();
    const deliveries: Platform[][] = [];
    const dispose = observeCompanionPlatforms(f.root, platforms => deliveries.push(platforms));
    f.flush(); const calls = f.range.getClientRects.mock.calls.length;
    const oldDate = deliveries.at(-1)!.find(p => p.kind === "date")!;
    f.date.rect = box(200, 280, 100, 20); f.title.rect = box(500, 430, 200, 20);
    f.win.emit("scroll"); f.advance(120);
    expect(f.range.getClientRects).toHaveBeenCalledTimes(calls);
    expect(deliveries.at(-1)!.find(p => p.id === oldDate.id)?.y).toBe(oldDate.y - 20);
    f.callbacks[2]([{ type: "characterData", target: { parentElement: f.title } } as unknown as MutationRecord]); f.advance(120);
    expect(f.range.getClientRects).toHaveBeenCalledTimes(calls + 1);
    f.fontEvents.emit("loadingdone"); f.advance(120);
    expect(f.range.getClientRects).toHaveBeenCalledTimes(calls + 3);
    dispose();
  });
});

function addHouseFloor(fixture: ReturnType<typeof geometryFixture>) {
  const house = new FixtureElement(), room = new FixtureElement(), floor = new FixtureElement();
  house.parentElement = fixture.sourceRoot; room.parentElement = house; floor.parentElement = room; fixture.home.parentElement = room;
  house.rect = box(100, 480, 360, 190); room.rect = box(110, 528, 340, 132); floor.rect = box(110, 624, 340, 36); fixture.home.rect = box(145, 632, 130, 2);
  fixture.home.closest = selector => selector === ".vc-home" ? house : null;
  house.querySelector = selector => selector === ".vc-home-floor" ? floor : null;
  const style = fixture.win.getComputedStyle();
  fixture.win.getComputedStyle.mockImplementation(element => element === room ? { ...style, overflowX: "hidden", overflowY: "hidden" } : style);
  const feed = new FixtureElement(); feed.parentElement = room; feed.rect = box(350, 590, 48, 62); fixture.controls.push(feed);
  const trash = new FixtureElement(); trash.parentElement = room; trash.rect = box(406, 596, 44, 56); fixture.controls.push(trash);
  return { house, room, floor, feed, trash };
}

function addStructuralSurfaces(fixture: ReturnType<typeof geometryFixture>, bands: FixtureElement[] = [], headers: FixtureElement[] = []) {
  const query = fixture.sourceRoot.querySelectorAll;
  fixture.sourceRoot.querySelectorAll = selector => selector.startsWith(".support-bar[data-supportid],") ? bands
    : selector.startsWith(".weekday-row,") ? headers : query(selector);
  for (const element of [...bands, ...headers]) element.parentElement = fixture.sourceRoot;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("companion geometry anchor subscription", () => {
  it("delivers a replacement home source even when every numeric safe span is unchanged", () => {
    const f = geometryFixture(), changed = vi.fn();
    let liveHome = f.home;
    const sub = observeCompanionPlatforms(f.root, changed, { size: 92, getHome: () => liveHome as unknown as HTMLElement }); f.flush();
    const original = changed.mock.calls.at(-1)![0] as Platform[];
    expect(sub.anchor("companion-home")?.element).toBe(f.home);
    changed.mockClear();
    const replacement = new FixtureElement(); replacement.rect = f.home.rect; replacement.parentElement = f.home.parentElement;
    f.home.isConnected = false; liveHome = replacement;
    f.win.emit("vic:companion-home"); f.advance(120);
    expect(changed).toHaveBeenCalledTimes(1); expect(changed.mock.calls[0][0]).toEqual(original);
    expect(sub.anchor("companion-home")?.element).toBe(replacement);
    changed.mockClear(); f.win.emit("vic:companion-home"); f.advance(120);
    expect(changed).not.toHaveBeenCalled(); sub();
  });
  it("delivers removal and remount of an equally positioned home without adding retries", () => {
    const f = geometryFixture(), changed = vi.fn(); let liveHome: FixtureElement | null = f.home;
    const sub = observeCompanionPlatforms(f.root, changed, { getHome: () => liveHome as unknown as HTMLElement | null }); f.flush(); changed.mockClear();
    liveHome = null; f.win.emit("vic:companion-home"); f.advance(120);
    expect(changed).toHaveBeenCalledTimes(1); expect(sub.anchor("companion-home")).toBeUndefined();
    liveHome = f.home; f.win.emit("vic:companion-home"); f.advance(120);
    expect(changed).toHaveBeenCalledTimes(2); expect(sub.anchor("companion-home")?.element).toBe(f.home);
    expect(f.frames.size + f.timers.size).toBe(0); sub();
  });
  it("measures real shared panel arrows as top ledges without covering their pointer targets", () => {
    const f = geometryFixture(), changed = vi.fn(), left = new FixtureElement(), right = new FixtureElement();
    left.parentElement = f.sourceRoot; right.parentElement = f.sourceRoot;
    left.rect = box(450, 740, 36, 44); right.rect = box(550, 740, 36, 44);
    left.getAttribute = name => name === "data-companion-panel-side" ? "left" : name === "aria-pressed" ? "true" : null;
    right.getAttribute = name => name === "data-companion-panel-side" ? "right" : name === "aria-pressed" ? "false" : null;
    f.controls.push(left, right);
    const query = f.sourceRoot.querySelectorAll;
    f.sourceRoot.querySelectorAll = selector => selector === COMPANION_PANEL_SIDE_SELECTOR ? [left, right] : query(selector);
    const off = observeCompanionPlatforms(f.root, changed, { size: 92 }); f.flush();
    const platforms = changed.mock.calls.at(-1)![0] as Platform[];
    expect(platforms.filter(platform => platform.kind === "control")).toEqual([
      { id: "panel-side-left", x: 450, y: 737, width: 36, kind: "control" },
      { id: "panel-side-right", x: 550, y: 737, width: 36, kind: "control", panelSide: "right" },
    ]);
    expect(off.anchor("panel-side-right")?.element).toBe(right);
    expect(off.follow(["panel-side-right"])[0].platform.panelSide).toBe("right");
    expect(platforms.filter(platform => platform.kind === "control").every(platform => platform.y < left.rect.top)).toBe(true);
    off();
  });
  it("notifies layout invalidation before a coalesced scan without reading geometry or surviving disposal", () => {
    const f = geometryFixture(), invalidate = vi.fn(), changed = vi.fn();
    const off = observeCompanionPlatforms(f.root, changed, { onInvalidate: invalidate });
    f.flush(); invalidate.mockClear(); changed.mockClear();
    f.title.getBoundingClientRect.mockClear(); f.win.getComputedStyle.mockClear(); f.range.getClientRects.mockClear();
    f.win.emit("scroll"); f.win.emit("scroll");
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(f.title.getBoundingClientRect).not.toHaveBeenCalled();
    expect(f.win.getComputedStyle).not.toHaveBeenCalled();
    expect(f.range.getClientRects).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    expect(f.timers.size + f.frames.size).toBe(1);
    off(); f.win.emit("scroll"); f.advance(200);
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(changed).not.toHaveBeenCalled();
    expect(f.timers.size + f.frames.size).toBe(0);
  });
  it("coalesces validation-only scans without layout reads or invalidation until the existing120ms boundary", () => {
    const f = geometryFixture(), invalidate = vi.fn(), changed = vi.fn();
    const sub = observeCompanionPlatforms(f.root, changed, { onInvalidate: invalidate }); f.flush();
    invalidate.mockClear(); changed.mockClear(); f.range.getClientRects.mockClear();
    f.date.rect = box(200, 310, 100, 20);
    sub.revalidate(); sub.revalidate(); sub.revalidate();
    expect(invalidate).not.toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
    expect(f.range.getClientRects).not.toHaveBeenCalled(); expect(f.timers.size + f.frames.size).toBe(1);
    f.advance(119); expect(changed).not.toHaveBeenCalled();
    f.advance(1); expect(changed).toHaveBeenCalledTimes(1); expect(changed.mock.calls[0][1]).toBe(true);
    expect((changed.mock.calls[0][0] as Platform[]).find(p => p.id === "date-1")?.y).toBe(307);
    expect(invalidate).not.toHaveBeenCalled(); expect(f.timers.size + f.frames.size).toBe(0); sub();
  });
  it.each(["validation-first", "real-first"] as const)("keeps real event priority when %s requests share a scan", order => {
    const f = geometryFixture(), invalidate = vi.fn(), changed = vi.fn();
    const sub = observeCompanionPlatforms(f.root, changed, { onInvalidate: invalidate }); f.flush();
    invalidate.mockClear(); changed.mockClear(); f.date.rect = box(200, 320, 100, 20);
    if (order === "validation-first") { sub.revalidate(); f.win.emit("scroll"); }
    else { f.win.emit("scroll"); sub.revalidate(); }
    sub.revalidate();
    expect(f.timers.size + f.frames.size).toBe(1); expect(invalidate).toHaveBeenCalledTimes(1);
    f.advance(120); expect(changed).toHaveBeenCalledTimes(1); expect(changed.mock.calls[0][1]).toBe(false);
    expect((changed.mock.calls[0][0] as Platform[]).find(p => p.id === "date-1")?.y).toBe(317); sub();
  });
  it("restores an entering cushion only after a validation scan proves its full safe span clear", () => {
    const f = geometryFixture(), invalidate = vi.fn(), changed = vi.fn();
    f.home.rect = box(-140, 600, 98.31, 2);
    const sub = observeCompanionPlatforms(f.root, changed, { size: 92, home: f.home as unknown as HTMLElement, onInvalidate: invalidate }); f.flush();
    expect(sub.landings().some(p => p.id === "companion-home")).toBe(false); invalidate.mockClear();
    const control = new FixtureElement(); control.parentElement = f.sourceRoot; control.rect = box(30, 530, 150, 80); f.controls.push(control);
    f.home.rect = box(36.65, 600, 98.31, 2); sub.revalidate(); f.advance(120);
    expect(sub.landings().some(p => p.id === "companion-home")).toBe(false);
    f.controls.splice(f.controls.indexOf(control), 1); sub.revalidate(); f.advance(120);
    const seat = sub.landings().find(p => p.id === "companion-home")!;
    expect(seat).toBeDefined(); expect(seat.x).toBeCloseTo(74.61); expect(seat.width).toBeCloseTo(22.39);
    expect(changed.mock.calls.at(-1)![1]).toBe(true); expect(invalidate).not.toHaveBeenCalled(); sub();
  });
  it("cancels queued validation and makes later validation inert after disposal", () => {
    const f = geometryFixture(), invalidate = vi.fn(), changed = vi.fn();
    const sub = observeCompanionPlatforms(f.root, changed, { onInvalidate: invalidate }); f.flush();
    invalidate.mockClear(); changed.mockClear(); f.range.getClientRects.mockClear();
    f.date.rect = box(200, 330, 100, 20); sub.revalidate(); expect(f.timers.size).toBe(1);
    sub(); sub.revalidate(); f.win.emit("scroll"); f.advance(1000);
    expect(changed).not.toHaveBeenCalled(); expect(invalidate).not.toHaveBeenCalled(); expect(f.range.getClientRects).not.toHaveBeenCalled();
    expect(f.timers.size + f.frames.size).toBe(0);
  });
  it("treats the studio day role as a calendar container while retaining nested edit/private controls and scroll anchors", () => {
    const f = geometryFixture(), edit = new FixtureElement(), privateCard = new FixtureElement();
    const marker = "[data-companion-event='ordinary'][data-eventid]";
    f.sourceRoot.getAttribute = name => name === "data-companion-surface" ? "studio" : null;
    f.day.rect = box(450, 280, 320, 320); f.day.matches = selector => selector.includes(".studio-day");
    f.card.parentElement = f.day; f.card.rect = box(470, 430, 260, 60); f.card.matches = selector => selector === marker;
    f.title.closest = selector => selector === marker ? f.card : selector.includes(".pill-main") ? f.title : selector.includes("data-eventid") ? f.card : null;
    edit.parentElement = f.card; edit.rect = box(680, 380, 40, 40);
    privateCard.parentElement = f.day; privateCard.rect = box(100, 360, 160, 90);
    f.controls.push(f.day, edit, privateCard);
    let platforms: Platform[] = [];
    const sub = observeCompanionPlatforms(f.root, next => { platforms = next; }, { size: 92 }); f.flush();
    const ledge = platforms.find(p => sub.anchor(p.id)?.element === (f.title as unknown as Element));
    expect(ledge, "a role=button day must not suppress its entire ordinary card").toBeDefined();
    expect(sub.landings().some(p => sub.anchor(p.id)?.element === (f.card as unknown as Element))).toBe(true);
    expectClear(platforms, [edit.rect, privateCard.rect], 92 * .76);
    const initial = ledge!; const ranges = f.range.getClientRects.mock.calls.length;
    f.title.rect = box(510, 354, 200, 20);
    expect(sub.follow([initial.id])[0]).toMatchObject({ platform: { x: initial.x + 10, y: initial.y - 96 }, anchorX: 510, anchorY: 354 });
    expect(f.range.getClientRects).toHaveBeenCalledTimes(ranges);
    sub();
  });
  it("publishes public studio weekday/band edges but never an unmarked support band", () => {
    const f = geometryFixture(), weekdays = new FixtureElement(), publicBand = new FixtureElement(), privateBand = new FixtureElement();
    f.sourceRoot.getAttribute = name => name === "data-companion-surface" ? "studio" : null;
    weekdays.rect = box(100, 70, 800, 60); weekdays.matches = selector => selector.includes(".studio-weekdays");
    publicBand.rect = box(100, 550, 400, 22); publicBand.matches = selector => selector.includes("data-companion-band");
    privateBand.rect = box(100, 650, 400, 22);
    addStructuralSurfaces(f, [publicBand, privateBand], [weekdays]);
    let platforms: Platform[] = [];
    const sub = observeCompanionPlatforms(f.root, next => { platforms = next; }, { size: 92 }); f.flush();
    expect(platforms.some(p => p.id.includes("-header") && p.y === 127)).toBe(true);
    expect(platforms.some(p => p.id.includes("-band") && p.y === 547)).toBe(true);
    expect(platforms.some(p => p.id.includes("-band") && p.y === 647)).toBe(false);
    expectClear(platforms, [f.date.rect, f.title.rect], 92 * .76);
    sub();
  });
  it("uses anonymous public date chrome and opt-in studio cards, never unmarked private/support rows", () => {
    const f = geometryFixture(), privateCard = new FixtureElement(), privateTitle = new FixtureElement();
    const marker = "[data-companion-event='ordinary'][data-eventid]";
    f.card.rect = box(470, 430, 260, 60);
    f.sourceRoot.getAttribute = name => name === "data-companion-surface" ? "studio" : null;
    privateCard.parentElement = f.sourceRoot; privateTitle.parentElement = privateCard;
    privateCard.rect = box(110, 430, 250, 60); privateTitle.rect = box(140, 450, 100, 20);
    f.title.closest = selector => selector === marker ? f.card : selector.includes(".pill-main") ? f.title : selector.includes("data-eventid") ? f.card : null;
    privateTitle.closest = selector => selector === marker ? null : selector.includes(".pill-main") ? privateTitle : selector.includes("data-eventid") ? privateCard : null;
    f.card.matches = selector => selector === marker;
    f.sourceRoot.querySelectorAll = selector => selector.includes("data-eventid") ? [f.card, privateCard] : selector === ".public-day,.agenda-day" ? [f.sourceRoot] : [];
    const nodes = [{ parentElement: f.date }, { parentElement: f.title }, { parentElement: privateTitle }];
    f.root.ownerDocument.createTreeWalker = () => { let index = 0; return { nextNode: () => nodes[index++] ?? null } as unknown as TreeWalker; };
    let platforms: Platform[] = [];
    const sub = observeCompanionPlatforms(f.root, next => { platforms = next; }); f.flush();
    expect(platforms.filter(p => p.kind === "card").length).toBeGreaterThan(0);
    expect(platforms.some(p => p.kind === "date")).toBe(true);
    expect([...platforms, ...sub.landings(), ...sub.landings(32)].every(p => sub.anchor(p.id)?.element !== (privateCard as unknown as Element) && sub.anchor(p.id)?.element !== (privateTitle as unknown as Element))).toBe(true);
    expect(sub.landings().some(p => sub.anchor(p.id)?.element === (f.card as unknown as Element))).toBe(true);
    sub();
  });
  it("retains a prelude-inert physical public card until it actually leaves, but rejects unrelated ancestor locks", () => {
    const f = geometryFixture();
    f.sourceRoot.hasAttribute = name => name === "data-premiere";
    f.card.matches = selector => selector.includes("data-eventid");
    const originalClosest = f.title.closest;
    f.title.closest = selector => selector === "[inert],[aria-hidden='true']" ? f.card : originalClosest(selector);
    let platforms: Platform[] = [];
    const sub = observeCompanionPlatforms(f.root, next => { platforms = next; }); f.flush();
    expect(platforms.some(p => sub.anchor(p.id)?.element === (f.title as unknown as Element))).toBe(true);
    f.sourceRoot.closest = selector => selector.includes("[inert]") ? f.sourceRoot : null;
    f.win.emit("resize"); f.advance(120);
    expect(platforms.some(p => sub.anchor(p.id)?.element === (f.title as unknown as Element))).toBe(false);
    f.sourceRoot.closest = () => null;
    const css = f.win.getComputedStyle();
    f.win.getComputedStyle.mockImplementation(element => element === f.card ? { ...css, opacity: ".03" } : css);
    f.win.emit("resize"); f.advance(120);
    expect(platforms.some(p => sub.anchor(p.id)?.element === (f.title as unknown as Element))).toBe(false);
    sub();
  });
  it("offers the real house floor only as a manual feeding/drop support and keeps full controls clear", () => {
    const fixture = geometryFixture(), house = addHouseFloor(fixture); let autonomous: Platform[] = [];
    house.floor.hasAttribute = name => name === "aria-hidden"; // Decorative AT exclusion must not hide real floor ink.
    const subscription = observeCompanionPlatforms(fixture.root, next => { autonomous = next; }, { size: 92, home: fixture.home as unknown as HTMLElement }); fixture.flush();
    const floor = subscription.landings().filter(p => /^companion-home-floor(?:-\d+)?$/.test(p.id));
    expect(floor.length).toBeGreaterThan(0);
    expect(floor.every(p => p.y === 654 && p.kind === "floor" && p.manualOnly)).toBe(true);
    expect(autonomous.some(p => p.id.startsWith("companion-home-floor"))).toBe(false);
    expect(subscription.anchor(floor[0].id)).toEqual({ element: house.floor, left: 110, top: 624 });
    expectClear(floor, [text(350, 590, 398, 652), text(406, 596, 450, 652)], 92 * .76);
    const foodFloors = subscription.landings(32).filter(p => p.id.startsWith(COMPANION_HOME_FLOOR_FOOD));
    expect(foodFloors.length).toBeGreaterThan(0);
    expect(foodFloors.every(p => p.y === 654 && p.x >= 132 && p.x + p.width <= 428)).toBe(true);
    expectClear(foodFloors, [text(350, 590, 398, 652), text(406, 596, 450, 652)], 44);
    expect(subscription.anchor(foodFloors[0].id)).toEqual({ element: house.floor, left: 110, top: 624 });
    const dropped = placeCompanionFood({ id: "falling", kind: "apple", x: 300, y: 580 }, { x: 300, y: 580 }, subscription.landings(32));
    expect(dropped).toMatchObject({ x: 300, y: 654, platformId: foodFloors[0].id });
    const ranges = fixture.range.getClientRects.mock.calls.length; house.floor.getBoundingClientRect.mockClear();
    house.floor.rect = box(120, 594, 340, 36);
    expect(subscription.follow([floor[0].id])[0]).toMatchObject({ platform: { id: floor[0].id, x: floor[0].x + 10, y: 624, manualOnly: true }, anchorX: 120, anchorY: 594 });
    expect(house.floor.getBoundingClientRect).toHaveBeenCalledTimes(1);
    expect(fixture.range.getClientRects).toHaveBeenCalledTimes(ranges);
    subscription();
  });
  it("roams on actual support/period edges while retaining all text and native control protection", () => {
    const fixture = geometryFixture(), support = new FixtureElement(), period = new FixtureElement();
    support.rect = box(100, 420, 300, 22); period.rect = box(100, 550, 300, 52);
    fixture.date.rect = box(220, 380, 80, 20); fixture.controls.push(support, period);
    addStructuralSurfaces(fixture, [support, period]);
    let platforms: Platform[] = [];
    const subscription = observeCompanionPlatforms(fixture.root, next => { platforms = next; }, { size: 92 }); fixture.flush();
    const bands = () => platforms.filter(p => /-band(?:-\d+)?$/.test(p.id));
    expect(bands().length).toBeGreaterThanOrEqual(2);
    expect(bands().every(p => !p.manualOnly && p.kind === "card" && (p.y === 417 || p.y === 547))).toBe(true);
    expectClear(bands(), [fixture.date.rect, fixture.title.rect, support.rect, period.rect], 92 * .76);
    const first = bands().find(p => p.y === 417)!;
    expect(subscription.anchor(first.id)).toEqual({ element: support, left: 100, top: 420 });
    expect(support.getBoundingClientRect).toHaveBeenCalledTimes(1); // Control and structural edge share their rect.
    const ranges = fixture.range.getClientRects.mock.calls.length;
    support.rect = box(110, 440, 300, 22);
    expect(subscription.follow([first.id])[0]).toMatchObject({ platform: { x: first.x + 10, y: 437 }, anchorX: 110, anchorY: 440 });
    expect(fixture.range.getClientRects).toHaveBeenCalledTimes(ranges);
    period.closest = selector => selector.includes("[inert]") ? period : null;
    fixture.win.emit("resize"); fixture.advance(120); expect(bands().every(p => p.y !== 547)).toBe(true);
    subscription();
  });
  it("uses only real header-bottom gaps clear of weekday glyphs, controls and viewport bounds", () => {
    const fixture = geometryFixture(), header = new FixtureElement(), control = new FixtureElement();
    header.rect = box(100, 70, 800, 60); header.hasAttribute = name => name === "aria-hidden";
    control.rect = box(500, 60, 44, 44); fixture.controls.push(control);
    fixture.date.rect = box(220, 100, 30, 18);
    addStructuralSurfaces(fixture, [], [header]);
    let platforms: Platform[] = [];
    const subscription = observeCompanionPlatforms(fixture.root, next => { platforms = next; }, { size: 92 }); fixture.flush();
    const headers = () => platforms.filter(p => /-header(?:-\d+)?$/.test(p.id));
    expect(headers().length).toBeGreaterThan(0);
    expect(headers().every(p => p.y === 127 && p.kind === "date" && !p.manualOnly)).toBe(true);
    expectClear(headers(), [fixture.date.rect, control.rect], 92 * .76);
    expect(subscription.anchor(headers()[0].id)).toEqual({ element: header, left: 100, top: 70 });
    header.rect = box(100, 0, 800, 80); fixture.win.emit("resize"); fixture.advance(120); expect(headers()).toEqual([]);
    header.rect = box(100, 70, 800, 60); header.hasAttribute = name => name === "hidden"; fixture.win.emit("resize"); fixture.advance(120); expect(headers()).toEqual([]);
    subscription();
  });
  it("withholds a folded, clipped or control-covered house floor and publishes the real resized plane", () => {
    const fixture = geometryFixture(), house = addHouseFloor(fixture);
    const subscription = observeCompanionPlatforms(fixture.root, () => {}, { size: 92, home: fixture.home as unknown as HTMLElement }); fixture.flush();
    const floors = () => subscription.landings().filter(p => p.id.startsWith("companion-home-floor"));
    expect(floors().length).toBeGreaterThan(0);
    house.house.hasAttribute = name => name === "hidden"; fixture.win.emit("vic:panel-section"); fixture.advance(120); expect(floors()).toEqual([]);
    house.house.hasAttribute = () => false; house.room.rect = box(110, 528, 340, 90); fixture.win.emit("resize"); fixture.advance(120); expect(floors()).toEqual([]);
    house.room.rect = box(110, 528, 340, 132); house.floor.rect = box(110, 614, 340, 36); fixture.win.emit("resize"); fixture.advance(120);
    expect(floors().every(p => p.y === 644)).toBe(true); expect(floors().length).toBeGreaterThan(0);
    house.feed.rect = box(0, 500, 1000, 170); fixture.win.emit("resize"); fixture.advance(120); expect(floors()).toEqual([]);
    subscription();
  });
  it("reserves its real house floor before a dense calendar reaches the200-food-surface budget", () => {
    const fixture = geometryFixture(); addHouseFloor(fixture);
    const cards = Array.from({ length: 240 }, () => { const card = new FixtureElement(); card.parentElement = fixture.sourceRoot; card.rect = box(470, 430, 260, 60); return card; });
    const query = fixture.sourceRoot.querySelectorAll;
    fixture.sourceRoot.querySelectorAll = selector => selector.includes("[data-eventid]") && !selector.includes(" ") ? cards : query(selector);
    const subscription = observeCompanionPlatforms(fixture.root, () => {}, { size: 92, home: fixture.home as unknown as HTMLElement }); fixture.flush();
    const food = subscription.landings(32);
    expect(food).toHaveLength(200);
    expect(food[0].id.startsWith(COMPANION_HOME_FLOOR_FOOD)).toBe(true);
    expect(subscription.anchor(food[0].id)?.element).toBeDefined();
    subscription();
  });
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
  it("catches food on the first actual card even when an earlier control cuts a gap in its safe landing centres", () => {
    const fixture = geometryFixture(); fixture.card.rect = box(470, 430, 260, 60);
    const control = new FixtureElement(); control.parentElement = fixture.sourceRoot; control.rect = box(580, 400, 40, 40); fixture.controls.push(control);
    const subscription = observeCompanionPlatforms(fixture.root, () => {}, { size: 92 }); fixture.flush();
    const food = subscription.landings(32), point = { x: 600, y: 370 };
    const safeTop = food.filter(p => p.id.includes("-food-top"));
    expect(safeTop.length).toBe(2);
    expect(safeTop.some(p => point.x >= p.x && point.x <= p.x + p.width)).toBe(false);
    const placed = placeCompanionFood({ id: "falling", kind: "apple", ...point }, point, food, viewport);
    expect(placed.platformId).toMatch(/-food-top(?:-\d+)?$/);
    expect(placed.y).toBe(427);
    expect(placed.x).toBe(555);
    expect(placed.x + 22).toBeLessThan(control.rect.left);
    expect(placeCompanionFood({ id: "outside", kind: "apple", x: 800, y: 370 }, { x: 800, y: 370 }, food, viewport).platformId).toMatch(/^viewport-floor-food/);
    const first = safeTop[0] as CompanionFoodDropSupport;
    expect(first.dropSurface).toEqual({ x: 470, width: 260 });
    first.dropSurface = { x: -1000, width: 9000 };
    expect((subscription.landings(32).find(p => p.id === first.id) as CompanionFoodDropSupport).dropSurface).toEqual({ x: 470, width: 260 });
    expect(subscription.landings().every(p => !(p as CompanionFoodDropSupport).dropSurface)).toBe(true);
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
  it("retains the creature sofa but never publishes it as a food landing, including at food-only heights", () => {
    const fixture = geometryFixture(); fixture.home.rect = box(200, 62, 120, 2);
    const control = new FixtureElement(); control.parentElement = fixture.sourceRoot; control.rect = box(0, 680, 1000, 40); fixture.controls.push(control);
    const subscription = observeCompanionPlatforms(fixture.root, () => {}, { size: 92, home: fixture.home as unknown as HTMLElement }); fixture.flush();
    expect(subscription.landings().some(p => p.id === "companion-home" || p.kind === "floor")).toBe(false);
    expect(subscription.landings(32).some(p => /^companion-home(?:-food)?(?:-\d+)?$/.test(p.id))).toBe(false);
    expect(subscription.landings(32).some(p => p.id === "viewport-floor-food" && p.y === 782)).toBe(true);
    fixture.home.rect = box(200, 600, 120, 2); fixture.win.emit("resize"); fixture.advance(120);
    expect(subscription.landings().find(p => p.id === "companion-home")).toMatchObject({ y: 600 });
    expect(subscription.landings(32).some(p => /^companion-home(?:-food)?(?:-\d+)?$/.test(p.id))).toBe(false);
    expect(subscription.anchor("companion-home-food")).toBeUndefined();
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
    expect(result[1]).toMatchObject({ platform: { id: "companion-home", x: 210 + 76 * .38 + 3, y: 620 }, anchorX: 210, anchorY: 620 });
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

  it("acknowledges one explicit validation even when geometry is unchanged, then resumes suppression", () => {
    const fixture = geometryFixture(), changed = vi.fn();
    const subscription = observeCompanionPlatforms(fixture.root, changed); fixture.flush();
    changed.mockClear();
    subscription.revalidate(); fixture.advance(120);
    expect(changed).not.toHaveBeenCalled();
    subscription.revalidate(true); subscription.revalidate(true);
    expect(changed).not.toHaveBeenCalled();
    expect(fixture.timers.size).toBe(1);
    fixture.advance(120);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0][1]).toBe(true);
    subscription.revalidate(); fixture.advance(120);
    expect(changed).toHaveBeenCalledTimes(1);
    subscription();
  });

  it("offers an inert callable follow handle when a capture has no browsing window", () => {
    const subscription = observeCompanionPlatforms({ ownerDocument: { defaultView: null } } as unknown as HTMLElement, vi.fn());
    expect(subscription.follow(["anything"])).toEqual([]); expect(() => subscription.revalidate()).not.toThrow(); expect(() => subscription()).not.toThrow();
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
