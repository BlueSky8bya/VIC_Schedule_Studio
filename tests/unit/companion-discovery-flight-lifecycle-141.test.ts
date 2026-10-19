import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REDUCE_MOTION_EVENT } from "@/lib/ui/motion";
import type { CompanionDiscoveryNotice } from "@/lib/ui/viewer-companion/discovery-flight";

const hooks = vi.hoisted(() => ({ refs: [] as { current: unknown }[], cursor: 0, effects: [] as (() => void | (() => void))[] }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useRef: (initial: unknown) => hooks.refs[hooks.cursor++] ?? (hooks.refs[hooks.cursor - 1] = { current: initial }), useLayoutEffect: (effect: () => void | (() => void)) => hooks.effects.push(effect) }));
let Component: typeof import("@/components/poster/viewer-companion/companion-discovery-flight")["CompanionDiscoveryFlight"];
let pending: { resolve: () => void; reject: () => void }[];
let document: EventTarget & { hidden: boolean };
let media: EventTarget & { matches: boolean };
let matchMedia: ReturnType<typeof vi.fn>;
let root: { reduced: boolean; dataset: { gfx: string }; hasAttribute: () => boolean };
let win: EventTarget;
let node: { animate: ReturnType<typeof vi.fn>; ownerDocument: unknown; querySelector: ReturnType<typeof vi.fn> };
let book: { getBoundingClientRect: ReturnType<typeof vi.fn> };
const complete = vi.fn();
const notice = (serial: number): CompanionDiscoveryNotice => ({ serial, kind: "toy", id: "ball", source: { x: 200, y: 180 } });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function mount(value: CompanionDiscoveryNotice | null, enabled = true) {
  hooks.cursor = 0; hooks.effects = [];
  const element = Component({ notice: value, enabled, onComplete: complete }) as ReactElement<Record<string, unknown>>;
  hooks.refs[0].current = node;
  const cleanup = hooks.effects[0](); return { element, cleanup: () => cleanup?.() };
}
beforeEach(async () => {
  hooks.refs = []; pending = []; complete.mockReset(); vi.stubGlobal("React", await import("react"));
  ({ CompanionDiscoveryFlight: Component } = await import("@/components/poster/viewer-companion/companion-discovery-flight"));
  root = { reduced: false, dataset: { gfx: "full" }, hasAttribute: () => root.reduced };
  media = Object.assign(new EventTarget(), { matches: false });
  matchMedia = vi.fn(() => media);
  book = { getBoundingClientRect: vi.fn(() => ({ left: 460, top: 200, width: 40, height: 40, right: 500, bottom: 240 })) };
  Object.assign(book, { isConnected: true, closest: () => null });
  win = Object.assign(new EventTarget(), { innerWidth: 1000, innerHeight: 800, matchMedia,
    getComputedStyle: () => ({ visibility: "visible", getPropertyValue: () => "ease-out" }),
    Image: class { src = ""; decode() { return new Promise<void>((resolve, reject) => pending.push({ resolve, reject: () => reject(new Error("decode")) })); } },
  });
  document = Object.assign(new EventTarget(), { hidden: false, defaultView: win, documentElement: root, querySelectorAll: () => [book] });
  node = { ownerDocument: document, querySelector: vi.fn(selector => selector === "img" ? { currentSrc: "/companion/home/125/toy-ball.webp" } : null), animate: vi.fn(() => ({ onfinish: null as (() => void) | null, cancel: vi.fn() })) };
});
afterEach(() => vi.unstubAllGlobals());

describe("141 discovery presentation lifecycle; stub DOM, no runtime experience injection", () => {
  it("waits for its one actual picture, completes once and never replays a rerendered serial", async () => {
    const first = mount(notice(1)); expect(node.animate).not.toHaveBeenCalled(); expect(pending).toHaveLength(1); expect(book.getBoundingClientRect).toHaveBeenCalledTimes(1);
    pending[0].resolve(); await flush(); expect(node.animate).toHaveBeenCalledTimes(1);
    const animation = node.animate.mock.results[0].value; animation.onfinish!(); first.cleanup(); expect(complete.mock.calls).toEqual([[1]]);
    mount({ ...notice(1) }); expect(pending).toHaveLength(1); expect(node.animate).toHaveBeenCalledTimes(1);
  });
  it("cancels an old pending decode while letting the newer serial finish independently", async () => {
    const first = mount(notice(1)); first.cleanup(); const second = mount(notice(2));
    pending[0].resolve(); await flush(); expect(node.animate).not.toHaveBeenCalled();
    pending[1].resolve(); await flush(); expect(node.animate).toHaveBeenCalledTimes(1);
    node.animate.mock.results[0].value.onfinish!(); second.cleanup(); expect(complete.mock.calls).toEqual([[1], [2]]);
  });
  it("cancels on actual hidden/in-app reduced/graphics boundaries without starting a new loop", async () => {
    for (const boundary of ["hidden", "reduced", "graphics"] as const) {
      const serial = complete.mock.calls.length + 1, mounted = mount(notice(serial)); pending.at(-1)!.resolve(); await flush();
      const animation = node.animate.mock.results.at(-1)!.value, count = node.animate.mock.calls.length;
      if (boundary === "hidden") { document.hidden = true; document.dispatchEvent(new Event("visibilitychange")); }
      if (boundary === "reduced") { root.reduced = true; win.dispatchEvent(new Event(REDUCE_MOTION_EVENT)); }
      if (boundary === "graphics") { root.dataset.gfx = "off"; win.dispatchEvent(new Event("vic:gfx-pref")); }
      mounted.cleanup(); expect(animation.cancel).toHaveBeenCalledOnce(); expect(node.animate).toHaveBeenCalledTimes(count); expect(complete.mock.calls.at(-1)).toEqual([serial]);
      document.hidden = false; root.reduced = false; root.dataset.gfx = "full"; media.matches = false;
    }
    expect(complete).toHaveBeenCalledTimes(3);
  });
  it("follows in-app motion authority when OS reduced motion differs, without reading or listening to its media query", async () => {
    media.matches = true; const listening = vi.spyOn(media, "addEventListener");
    const mounted = mount(notice(1)); pending[0].resolve(); await flush();
    const animation = node.animate.mock.results[0].value;
    expect(node.animate.mock.calls[0][1].duration).toBe(1500);
    expect(matchMedia).not.toHaveBeenCalled(); expect(listening).not.toHaveBeenCalled();
    media.matches = false; media.dispatchEvent(new Event("change")); expect(animation.cancel).not.toHaveBeenCalled();
    root.reduced = true; win.dispatchEvent(new Event(REDUCE_MOTION_EVENT));
    expect(animation.cancel).toHaveBeenCalledOnce(); expect(complete.mock.calls).toEqual([[1]]); mounted.cleanup();
  });
  it("does not read a destination or decode while blocked and fails closed on a broken image", async () => {
    mount(notice(1), false); expect(complete.mock.calls).toEqual([[1]]); expect(book.getBoundingClientRect).not.toHaveBeenCalled(); expect(pending).toEqual([]);
    const next = mount(notice(2)); pending[0].reject(); await flush(); next.cleanup();
    expect(node.animate).not.toHaveBeenCalled(); expect(complete.mock.calls).toEqual([[1], [2]]);
  });
  it("uses a stationary fade in graphics OFF while retaining only one decorative asset", async () => {
    root.dataset.gfx = "off"; const mounted = mount(notice(1)); pending[0].resolve(); await flush();
    const [frames, options] = node.animate.mock.calls[0] as [Keyframe[], KeyframeAnimationOptions];
    expect(new Set(frames.map(frame => frame.transform))).toEqual(new Set(["translate3d(176px,156px,0) scale(1)"])); expect(options.duration).toBeLessThanOrEqual(600);
    expect(mounted.element.props["aria-hidden"]).toBe("true"); expect(mounted.element.props.children).toBeTruthy(); expect(Array.isArray(mounted.element.props.children)).toBe(false); mounted.cleanup();
  });
});
