import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomeWindow } from "@/components/poster/viewer-companion/companion-home-window";
import { INITIAL_COMPANION_HOME_CURTAIN } from "@/lib/ui/viewer-companion/home-curtain";
import { REDUCE_MOTION_EVENT, setReduceMotion } from "@/lib/ui/motion";
import { companionCurtainStage, companionCurtainStops, companionCurtainWeights, createCompanionCurtainTransition, type CompanionCurtainLayer, type CompanionCurtainStage } from "@/lib/ui/viewer-companion/home-curtain-transition";

beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());
const options = { stepMs: 180, easing: "ease-in-out" };

function harness(initialStage: CompanionCurtainStage = 0) {
  let shown = [1, 0, 0, 0, 0];
  const inline = [1, 0, 0, 0, 0], calls: { frames: Keyframe[]; options: KeyframeAnimationOptions; animation: Pick<Animation, "cancel" | "onfinish"> }[] = [];
  const reads = vi.fn((index: number) => shown[index]);
  const layers: CompanionCurtainLayer[] = inline.map((_, index) => ({
    opacity(value) { inline[index] = value; }, readOpacity: () => reads(index),
    animate(frames, options) { const animation = { onfinish: null as Animation["onfinish"], cancel: vi.fn() }; calls.push({ frames, options, animation }); return animation; },
  }));
  const controller = createCompanionCurtainTransition(layers, initialStage);
  return { controller, inline, calls, reads, show(weights: number[]) { shown = weights; } };
}

describe("126 five generated curtain stages", () => {
  it("keeps the actual rest meaning and distinguishes light, medium and strong personality shade", () => {
    expect(companionCurtainStage(INITIAL_COMPANION_HOME_CURTAIN)).toBe(0);
    expect(companionCurtainStage({ phase: "closed", panelScale: 1 })).toBe(4);
    for (const value of [.18, .22]) expect(companionCurtainStage({ phase: "shade", panelScale: value })).toBe(1);
    for (const value of [.26, .28]) expect(companionCurtainStage({ phase: "shade", panelScale: value })).toBe(2);
    for (const value of [.36, .42]) expect(companionCurtainStage({ phase: "shade", panelScale: value })).toBe(3);
    expect(companionCurtainStage({ phase: "shade", panelScale: NaN })).toBe(1);
  });
  it("walks every adjacent generated picture in both directions, starting at a fractional reversal blend", () => {
    expect(companionCurtainStops(0, 4).stops.map(stop => stop.position)).toEqual([0, 1, 2, 3, 4]);
    expect(companionCurtainStops(4, 0).stops.map(stop => stop.position)).toEqual([4, 3, 2, 1, 0]);
    const reversed = companionCurtainStops(2.4, 0);
    expect(reversed.stops.map(stop => stop.position)).toEqual([2.4, 2, 1, 0]);
    expect(reversed.stops[0].weights).toEqual([0, 0, .6000000000000001, .3999999999999999, 0]);
    expect(reversed.stops.at(-1)?.offset).toBe(1);
    for (const at of [NaN, -10, 0, .3, 2.4, 4, 10]) {
      const weights = companionCurtainWeights(at);
      expect(weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1);
      expect(weights.filter(value => value > 0).length).toBeLessThanOrEqual(2);
    }
  });
  it("animates five finite layers once and does not restart an unchanged semantic target", () => {
    const h = harness(); h.controller.update(4, true, options);
    expect(h.calls).toHaveLength(5); expect(h.calls[2].frames.map(frame => frame.opacity)).toEqual([0, 0, 1, 0, 0]);
    expect(h.calls.every(call => call.options.duration === 720 && call.options.iterations === 1)).toBe(true);
    h.controller.update(4, true, options); expect(h.calls).toHaveLength(5); expect(h.reads).not.toHaveBeenCalled();
    h.calls[0].animation.onfinish!.call({} as Animation, {} as AnimationPlaybackEvent);
    expect(h.inline).toEqual([0, 0, 0, 0, 1]); expect(h.calls.every(call => vi.mocked(call.animation.cancel).mock.calls.length === 1)).toBe(true);
    h.controller.update(4, true, options); expect(h.calls).toHaveLength(5);
  });
  it.each([3, 4] as const)("mounts an existing SSR stage%s without reopening or replaying earlier stages", stage => {
    const h = harness(stage); expect(h.inline).toEqual(Array.from({ length: 5 }, (_, index) => Number(index === stage)));
    h.controller.update(stage, true, options); expect(h.calls).toHaveLength(0); expect(h.reads).not.toHaveBeenCalled();
    expect(h.inline).toEqual(Array.from({ length: 5 }, (_, index) => Number(index === stage)));
  });
  it("reverses from the actual current mix, cancels obsolete work and rejects a late old finish", () => {
    const h = harness(); h.controller.update(4, true, options); const stale = h.calls[0].animation.onfinish!;
    h.show([0, 0, .6, .4, 0]); h.controller.update(0, true, options);
    expect(h.reads).toHaveBeenCalledTimes(5); expect(h.calls).toHaveLength(10);
    expect(h.calls[7].frames[0].opacity).toBeCloseTo(.6); expect(h.calls[8].frames[0].opacity).toBeCloseTo(.4);
    expect(h.calls[5].options.duration).toBeCloseTo(432);
    expect(h.calls.slice(0, 5).every(call => call.animation.onfinish === null && vi.mocked(call.animation.cancel).mock.calls.length === 1)).toBe(true);
    stale.call({} as Animation, {} as AnimationPlaybackEvent);
    expect(h.calls.slice(5).every(call => vi.mocked(call.animation.cancel).mock.calls.length === 0)).toBe(true);
  });
  it("cancels a disabled finite transition and shows its current target statically without a replay", () => {
    const h = harness(); h.controller.update(4, true, options); h.controller.update(1, false, options);
    expect(h.inline).toEqual([0, 1, 0, 0, 0]); expect(h.calls).toHaveLength(5);
    expect(h.calls.every(call => vi.mocked(call.animation.cancel).mock.calls.length === 1)).toBe(true);
    h.controller.update(1, true, options); expect(h.calls).toHaveLength(5);
  });
  it("disposes all five effects and accepts no callback or new work after unmount", () => {
    const h = harness(); h.controller.update(4, true, options); h.controller.dispose(); h.controller.update(0, true, options);
    expect(h.calls).toHaveLength(5); expect(h.calls.every(call => call.animation.onfinish === null && vi.mocked(call.animation.cancel).mock.calls.length === 1)).toBe(true);
  });
  it("the existing same-window motion toggle emits only a re-read boundary and cancels the finite effect immediately", () => {
    const h = harness(), events = new EventTarget(), attributes = new Set<string>(), setItem = vi.fn(), observed = vi.fn();
    vi.stubGlobal("window", { localStorage: { setItem }, dispatchEvent(event: Event) { observed(event); return events.dispatchEvent(event); } });
    vi.stubGlobal("document", { documentElement: { setAttribute(name: string) { attributes.add(name); }, removeAttribute(name: string) { attributes.delete(name); } } });
    events.addEventListener(REDUCE_MOTION_EVENT, () => h.controller.update(4, !attributes.has("data-reduce-motion"), options));
    h.controller.update(4, true, options); setReduceMotion(true);
    expect(setItem).toHaveBeenCalledWith("vic.reduceMotion", "on"); expect(observed).toHaveBeenCalledTimes(1);
    expect(observed.mock.calls[0][0].type).toBe(REDUCE_MOTION_EVENT); expect(observed.mock.calls[0][0]).not.toHaveProperty("detail");
    expect(h.calls.every(call => vi.mocked(call.animation.cancel).mock.calls.length === 1)).toBe(true); expect(h.inline).toEqual([0, 0, 0, 0, 1]);
    setReduceMotion(false); expect(observed).toHaveBeenCalledTimes(2); expect(attributes.has("data-reduce-motion")).toBe(false); expect(h.calls).toHaveLength(5);
  });
  it("keeps the real picture when WAAPI is unavailable rather than creating a placeholder", () => {
    const inline = [0, 0, 0, 0, 0], layers = inline.map((_, index) => ({ opacity(value: number) { inline[index] = value; }, readOpacity: () => inline[index] }));
    createCompanionCurtainTransition(layers).update(4, true, options); expect(inline).toEqual([0, 0, 0, 0, 1]);
  });
  it("mounts scenery, real frame and weather beneath exactly five lazy transparent overlays without human controls", () => {
    const render = (closed: boolean) => renderToStaticMarkup(React.createElement(HomeWindow, { environment: { date: { y: 2026, m: 10, d: 19 }, season: "autumn", weather: "rain", band: "night", night: true, hour: 23 }, curtain: closed ? { ...INITIAL_COMPANION_HOME_CURTAIN, phase: "closed", panelScale: 1 } : INITIAL_COMPANION_HOME_CURTAIN }));
    const open = render(false), closed = render(true);
    for (const html of [open, closed]) {
      expect(html).toContain('/companion/home/125/window-autumn-night.webp'); expect(html).toContain('/companion/home/124/window-rain-overlay.webp');
      expect(html).toContain('class="vc-window-crossbar"'); expect(html).toContain('class="vc-window-sill"');
      expect(html.match(/src="\/companion\/home\/126\/curtain-stage-\d.webp"/g)).toHaveLength(5);
      expect(html.match(/loading="lazy"/g)).toHaveLength(7); expect(html).not.toMatch(/<button|data-act=|curtain-panel|scaleX/);
      expect(html.indexOf('class="vc-window-curtain-overlay"')).toBeGreaterThan(html.indexOf('class="vc-window-sill"'));
    }
    expect(open).toContain('data-curtain-stage="0"'); expect(closed).toContain('data-curtain-stage="4"');
  });
});
