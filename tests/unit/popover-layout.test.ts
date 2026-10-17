import { afterEach, expect, it, vi } from "vitest";
import { trackPopoverLayout, LAYOUT_MOTION_EVENT } from "@/lib/ui/popover-layout";
import { flipSpring } from "@/lib/ui/flip-motion";
import { createCompanionCardPlay } from "@/lib/ui/viewer-companion/card-play";

class ElementFixture extends EventTarget {
  parentElement: ElementFixture | null = null;
  offsetWidth = 100;
  style = { transition: "", transform: "", transformOrigin: "" };
  dataset: Record<string, string> = {};
  animate = vi.fn(() => ({ cancel: vi.fn(), onfinish: null }));
  removeAttribute(name: string) { if (name === "data-vc-ruffled") delete this.dataset.vcRuffled; }
  contains(other: ElementFixture): boolean { return other === this || !!other.parentElement && this.contains(other.parentElement); }
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function environment() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  const body = new ElementFixture(), root = new ElementFixture(), anchor = new ElementFixture(), panel = new ElementFixture();
  root.parentElement = body; anchor.parentElement = root; panel.parentElement = body;
  const win = Object.assign(new EventTarget(), { visualViewport: new EventTarget() });
  const doc = Object.assign(new EventTarget(), { hidden: false, body, fonts: new EventTarget(), documentElement: { hasAttribute: () => false } });
  let resize!: () => void;
  const observe = vi.fn(), disconnect = vi.fn();
  vi.stubGlobal("HTMLElement", ElementFixture); vi.stubGlobal("window", win); vi.stubGlobal("document", doc);
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(performance.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
  vi.stubGlobal("ResizeObserver", class { constructor(fn: () => void) { resize = fn; } observe = observe; disconnect = disconnect; });
  return { win, doc, root, anchor, panel, observe, disconnect, resize: () => resize(), elements: () => [anchor as unknown as HTMLElement, panel as unknown as HTMLElement] };
}

it("has zero idle measurements after entrance, then follows scroll, resize and the existing FLIP spring", async () => {
  const env = environment();
  let position = 10, measured = 0;
  const update = vi.fn(() => { measured = position; });
  const stop = trackPopoverLayout({ update, elements: env.elements });
  await vi.advanceTimersByTimeAsync(1200);
  const entrance = update.mock.calls.length;
  expect(entrance).toBeGreaterThan(0); expect(entrance).toBeLessThan(60);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(update).toHaveBeenCalledTimes(entrance);
  position = 50; env.win.dispatchEvent(new Event("scroll"));
  await vi.advanceTimersByTimeAsync(16); expect(measured).toBe(50);
  await vi.advanceTimersByTimeAsync(1200);
  position = 70; env.resize(); await vi.advanceTimersByTimeAsync(16); expect(measured).toBe(70);
  await vi.advanceTimersByTimeAsync(1200);
  position = 90; flipSpring(env.root as unknown as HTMLElement, "translateX(100px)");
  await vi.advanceTimersByTimeAsync(16); expect(measured).toBe(90);
  await vi.advanceTimersByTimeAsync(1200);
  const settled = update.mock.calls.length;
  // An animated descendant is not an anchor/ancestor layout change.
  const child = new ElementFixture(); child.parentElement = env.anchor;
  const transition = new Event("transitionrun"); Object.defineProperty(transition, "target", { value: child });
  env.win.dispatchEvent(transition);
  await vi.advanceTimersByTimeAsync(1000); expect(update).toHaveBeenCalledTimes(settled);
  expect(vi.getTimerCount()).toBe(0);
  expect(env.observe).toHaveBeenCalledTimes(3);
  stop(); expect(env.disconnect).toHaveBeenCalledTimes(1);
});

it("cancels on hidden/unmount and resumes one bounded lease with the latest geometry", async () => {
  const env = environment(); const update = vi.fn();
  const stop = trackPopoverLayout({ update, elements: env.elements });
  env.doc.hidden = true; env.doc.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(2000); expect(update).not.toHaveBeenCalled();
  env.win.dispatchEvent(new Event("input"));
  env.win.dispatchEvent(new CustomEvent(LAYOUT_MOTION_EVENT, { detail: { element: env.root, ms: 520 } }));
  expect(vi.getTimerCount()).toBe(0);
  env.doc.hidden = false; env.doc.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(16); expect(update).toHaveBeenCalledTimes(1);
  stop(); await vi.advanceTimersByTimeAsync(10_000);
  env.win.dispatchEvent(new Event("scroll"));
  expect(update).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
});

it("follows both real WAAPI card-play windows while remaining idle during the held angle", async () => {
  const env = environment(); const update = vi.fn();
  vi.stubGlobal("getComputedStyle", () => ({ rotate: "2.2deg" }));
  const stop = trackPopoverLayout({ update, elements: env.elements });
  await vi.advanceTimersByTimeAsync(1200); update.mockClear();
  const play = createCompanionCardPlay();
  play.bump(env.anchor as unknown as HTMLElement, 1);
  await vi.advanceTimersByTimeAsync(16); expect(update).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(1200); const bumped = update.mock.calls.length;
  await vi.advanceTimersByTimeAsync(4000); expect(update).toHaveBeenCalledTimes(bumped);
  await vi.advanceTimersByTimeAsync(1300); // the real6500ms automatic restore
  expect(env.anchor.animate).toHaveBeenCalledTimes(2);
  expect(update.mock.calls.length).toBeGreaterThan(bumped);
  await vi.advanceTimersByTimeAsync(1200); const restored = update.mock.calls.length;
  await vi.advanceTimersByTimeAsync(2000); expect(update).toHaveBeenCalledTimes(restored);
  play.clear(); stop(); expect(vi.getTimerCount()).toBe(0);
});
