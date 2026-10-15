import { describe, expect, it } from "vitest";
import { createCompanionPettingGesture } from "@/lib/ui/viewer-companion/petting";

describe("deliberate head strokes", () => {
  it("ignores a stationary hover and small pointer jitter", () => {
    const gesture = createCompanionPettingGesture();
    for (let i = 0; i < 30; i++) expect(gesture.sample(.5 + (i % 2) * .03, i * 20)).toEqual({ stroking: false, reward: false });
  });
  it("requires back and forth rather than one pass", () => {
    const gesture = createCompanionPettingGesture();
    expect(gesture.sample(.2, 0).stroking).toBe(false);
    expect(gesture.sample(.8, 100).stroking).toBe(false);
    expect(gesture.sample(.2, 200).stroking).toBe(false);
    expect(gesture.sample(.8, 300)).toEqual({ stroking: true, reward: true });
  });
  it("keeps animation responsive while throttling affection rewards", () => {
    const gesture = createCompanionPettingGesture();
    [.2, .8, .2, .8].forEach((x, i) => gesture.sample(x, i * 100));
    for (let at = 400; at < 4300; at += 100) expect(gesture.sample(at % 200 ? .8 : .2, at)).toEqual({ stroking: true, reward: false });
    expect(gesture.sample(.8, 4300)).toEqual({ stroking: true, reward: true });
  });
  it("forgets partial strokes after leaving or an idle gap", () => {
    const gesture = createCompanionPettingGesture();
    gesture.sample(.2, 0); gesture.sample(.8, 100); gesture.sample(.2, 200);
    expect(gesture.sample(.8, 800).stroking).toBe(false);
    gesture.reset(); expect(gesture.sample(.2, 900).stroking).toBe(false);
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
