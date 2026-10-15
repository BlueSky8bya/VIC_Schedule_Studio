import { describe, expect, it } from "vitest";
import { createCompanionPettingGesture, createCompanionPettingWindow } from "@/lib/ui/viewer-companion/petting";

describe("deliberate head strokes", () => {
  it("ignores a stationary hover and small pointer jitter", () => {
    const gesture = createCompanionPettingGesture();
    for (let i = 0; i < 30; i++) expect(gesture.sample(.5 + (i % 2) * .03, i * 20)).toEqual({ stroking: false, reward: false });
  });
  it("recognizes the first complete out-and-back, but not its outward pass", () => {
    const gesture = createCompanionPettingGesture();
    expect(gesture.sample(.2, 0).stroking).toBe(false);
    expect(gesture.sample(.8, 100).stroking).toBe(false);
    expect(gesture.sample(.2, 200)).toEqual({ stroking: true, reward: true });
    expect(gesture.sample(.8, 300)).toEqual({ stroking: true, reward: false });
  });
  it("accepts a gentle tenth-width round trip and rejects smaller jitter", () => {
    const gentle = createCompanionPettingGesture(), jitter = createCompanionPettingGesture();
    gentle.sample(.4, 0); expect(gentle.sample(.5, 100).reward).toBe(false);
    expect(gentle.sample(.4, 200)).toEqual({ stroking: true, reward: true });
    for (let at = 0; at <= 5000; at += 100) expect(jitter.sample(at % 200 ? .49 : .4, at)).toEqual({ stroking: false, reward: false });
  });
  it("keeps animation responsive while throttling affection rewards", () => {
    const gesture = createCompanionPettingGesture();
    gesture.sample(.2, 0); gesture.sample(.8, 100);
    expect(gesture.sample(.2, 200)).toEqual({ stroking: true, reward: true });
    for (let at = 300; at < 4200; at += 100) expect(gesture.sample(at % 200 ? .8 : .2, at)).toEqual({ stroking: true, reward: false });
    expect(gesture.sample(.2, 4200)).toEqual({ stroking: true, reward: true });
  });
  it("allows a slower return inside900ms, then forgets partial strokes at the idle boundary", () => {
    const gesture = createCompanionPettingGesture();
    gesture.sample(.2, 0); gesture.sample(.8, 100);
    expect(gesture.sample(.2, 999)).toEqual({ stroking: true, reward: true });
    gesture.reset(); gesture.sample(.2, 1100); gesture.sample(.8, 1200);
    expect(gesture.sample(.2, 2100)).toEqual({ stroking: false, reward: false });
    gesture.reset(); expect(gesture.sample(.2, 2200).stroking).toBe(false);
  });
  it("never rewards one-way movement, including after an earlier recognized stroke", () => {
    const oneWay = createCompanionPettingGesture();
    for (let step = 0; step <= 9; step++) expect(oneWay.sample(step / 10, step * 800).reward).toBe(false);
    const recognized = createCompanionPettingGesture();
    recognized.sample(.0, 0); recognized.sample(.1, 100); expect(recognized.sample(.0, 200).reward).toBe(true);
    for (let step = 1; step <= 7; step++) expect(recognized.sample(step / 10, 200 + step * 800).reward).toBe(false);
    expect(recognized.sample(.6, 6600).reward).toBe(true);
  });
  it("does not reset the reward cooldown when a pointer leaves", () => {
    const gesture = createCompanionPettingGesture();
    [.2, .8, .2, .8].forEach((x, i) => gesture.sample(x, i * 100));
    gesture.reset();
    const results = [.2, .8, .2, .8].map((x, i) => gesture.sample(x, 400 + i * 100));
    expect(results.at(-1)).toEqual({ stroking: true, reward: false });
  });
  it("does not renew an established stroke or rewards from stationary jitter", () => {
    const gesture = createCompanionPettingGesture();
    [.2, .8, .2, .8].forEach((x, i) => gesture.sample(x, i * 100));
    for (let at = 400; at <= 5000; at += 20) expect(gesture.sample(.8 + (at % 40 ? .01 : 0), at)).toEqual({ stroking: false, reward: false });
  });
  it("rejects nonfinite or backward clocks", () => {
    const gesture = createCompanionPettingGesture();
    gesture.sample(.2, 300); gesture.sample(.8, 400);
    expect(gesture.sample(.2, 200).stroking).toBe(false);
    expect(gesture.sample(NaN, 500).stroking).toBe(false);
    expect(gesture.sample(.2, Infinity).stroking).toBe(false);
  });
  it("recognizes a vertical out-and-back while preserving the scalar x API", () => {
    const gesture = createCompanionPettingGesture();
    expect(gesture.sample(.5, 0, .2)).toEqual({ stroking: false, reward: false });
    expect(gesture.sample(.5, 100, .6)).toEqual({ stroking: false, reward: false });
    expect(gesture.sample(.5, 200, .2)).toEqual({ stroking: true, reward: true });
    expect(gesture.sample(.5, 300, .6)).toEqual({ stroking: true, reward: false });
  });
  it("locks the first meaningful axis instead of rewarding a perpendicular corner", () => {
    const gesture = createCompanionPettingGesture();
    gesture.sample(.2, 0, .2); gesture.sample(.8, 100, .2);
    expect(gesture.sample(.8, 200, .8)).toEqual({ stroking: false, reward: false });
    expect(gesture.sample(.2, 300, .8)).toEqual({ stroking: true, reward: true });
  });
  it("does not renew a vertical reward from jitter and keeps cooldown across axis changes", () => {
    const gesture = createCompanionPettingGesture();
    gesture.sample(.5, 0, .2); gesture.sample(.5, 100, .6); expect(gesture.sample(.5, 200, .2).reward).toBe(true);
    for (let at = 300; at <= 5000; at += 20) expect(gesture.sample(.5 + (at % 40 ? .01 : 0), at, .2 + (at % 40 ? .01 : 0))).toEqual({ stroking: false, reward: false });
    gesture.reset(); gesture.sample(.2, 5100, .5); gesture.sample(.8, 5200, .5); expect(gesture.sample(.2, 5300, .5).reward).toBe(true);
    gesture.reset(); gesture.sample(.5, 5400, .2); gesture.sample(.5, 5500, .6); expect(gesture.sample(.5, 5600, .2).reward).toBe(false);
  });
});

describe("passive whole-body petting retention", () => {
  const base = { left: -.68, right: .68, top: -1.04, bottom: .10 };
  const start = { x: 0, y: -.4 };
  const arm = (window: ReturnType<typeof createCompanionPettingWindow>) => { window.move(start, base, 0); window.move({ x: .10, y: -.4 }, base, 100); };
  it("starts only inside the base, including a read-only eligibility check before the first move", () => {
    const window = createCompanionPettingWindow();
    expect(window.contains(start, base, 0)).toBe(true);
    expect(window.contains({ x: .8, y: -.4 }, base, 0)).toBe(false);
    expect(window.move({ x: .8, y: -.4 }, base, 0)).toBe(false);
    expect(window.move(start, base, 100)).toBe(true);
  });
  it("requires actual cumulative movement, and supports a first meaningful move across the boundary", () => {
    const window = createCompanionPettingWindow();
    window.move(start, base, 0);
    for (let at = 10; at <= 100; at += 10) window.move({ x: at % 20 ? .03 : 0, y: -.4 }, base, at);
    expect(window.contains({ x: .8, y: -.4 }, base, 100)).toBe(false);
    expect(window.move({ x: .9, y: -.4 }, base, 110)).toBe(true);
    expect(window.contains({ x: .9, y: -.4 }, base, 111)).toBe(true);
  });
  it("retains exactly thirty percent of a displayed body in all four directions", () => {
    for (const point of [{ x: -.98, y: -.4 }, { x: .98, y: -.4 }, { x: 0, y: -1.34 }, { x: 0, y: .40 }]) {
      const window = createCompanionPettingWindow(); arm(window);
      expect(window.move(point, base, 200)).toBe(true); expect(window.contains(point, base, 201)).toBe(true);
    }
    for (const point of [{ x: -.980001, y: -.4 }, { x: .980001, y: -.4 }, { x: 0, y: -1.340001 }, { x: 0, y: .400001 }]) {
      const window = createCompanionPettingWindow(); arm(window);
      expect(window.move(point, base, 200)).toBe(false); expect(window.contains(point, base, 201)).toBe(false);
    }
  });
  it("never renews the outside deadline from paints or same-point/jitter input", () => {
    const window = createCompanionPettingWindow(), outside = { x: .8, y: -.4 }; arm(window); window.move(outside, base, 200);
    for (let at = 220; at < 1100; at += 20) {
      expect(window.contains(outside, base, at)).toBe(true);
      expect(window.move({ x: .8 + (at % 40 ? .01 : 0), y: -.4 }, base, at)).toBe(true);
    }
    expect(window.contains(outside, base, 1099)).toBe(true); expect(window.contains(outside, base, 1100)).toBe(false);
    expect(window.move({ x: .9, y: -.4 }, base, 1101)).toBe(false);
    expect(window.move(start, base, 1102)).toBe(true); expect(window.contains(outside, base, 1103)).toBe(false);
  });
  it("keeps a stationary base hover eligible while reset immediately removes its outside ownership", () => {
    const window = createCompanionPettingWindow(); arm(window);
    expect(window.contains(start, base, 50000)).toBe(true); expect(window.contains({ x: .8, y: -.4 }, base, 50000)).toBe(false);
    window.reset(); expect(window.contains({ x: .8, y: -.4 }, base, 100)).toBe(false);
    expect(window.move(start, base, 101)).toBe(true); expect(window.contains({ x: .8, y: -.4 }, base, 102)).toBe(false);
  });
  it("rejects nonfinite inputs, invalid rectangles and backward clocks without creating activity", () => {
    const window = createCompanionPettingWindow(); arm(window);
    expect(window.contains(start, base, NaN)).toBe(false);
    expect(window.move({ x: Infinity, y: 0 }, base, 200)).toBe(false);
    expect(window.move(start, { ...base, right: base.left }, 300)).toBe(false);
    arm(window); expect(window.move(start, base, 99)).toBe(false);
    expect(window.contains({ x: .8, y: -.4 }, base, 100)).toBe(false);
  });
});
