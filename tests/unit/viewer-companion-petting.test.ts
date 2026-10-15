import { describe, expect, it } from "vitest";
import { createCompanionPettingGesture } from "@/lib/ui/viewer-companion/petting";

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
});
