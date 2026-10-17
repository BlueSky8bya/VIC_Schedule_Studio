import { describe, expect, it } from "vitest";
import { createCompanionHeldShake } from "@/lib/ui/viewer-companion/held-shake";

type Detector = ReturnType<typeof createCompanionHeldShake>;
type Point = { x: number; y: number };
const wave = (now: number, amplitude = 100, halfPeriod = 200) => {
  const position = now / halfPeriod, leg = Math.floor(position), phase = position - leg;
  return amplitude * (leg % 2 ? 1 - phase : phase);
};
function path(detector: Detector, point: (now: number) => Point, duration = 800, rate = 60, began = 0) {
  const start = point(0); detector.begin(start.x, start.y, began);
  for (let tick = 1; tick <= duration / 1000 * rate; tick++) {
    const time = tick / rate * 1000, position = point(time);
    detector.push(position.x, position.y, began + time);
  }
  return detector.sample(began + duration);
}
const horizontal = (now: number) => ({ x: 500 + wave(now), y: 400 });

describe("captured deliberate shaking", () => {
  it("recognizes the same timed path at30/60/120/240Hz without counting events", () => {
    const samples = [30, 60, 120, 240].map(rate => {
      const detector = createCompanionHeldShake();
      const result = path(detector, horizontal, 800, rate);
      expect(result.active).toBe(true);
      expect(result.phase).toBeGreaterThanOrEqual(0); expect(result.phase).toBeLessThan(1);
      expect(detector.consume(800)).toBe(true); expect(detector.consume(801)).toBe(false);
      return result;
    });
    samples.forEach(sample => expect(sample.phase).toBeCloseTo(samples[0].phase, 9));
  });
  it("accepts vertical and diagonal reversals, not just horizontal gestures", () => {
    for (const point of [(now: number) => ({ x: 500, y: 400 + wave(now) }), (now: number) => ({ x: 500 + wave(now) * .8, y: 400 + wave(now) * .6 })]) {
      expect(path(createCompanionHeldShake(), point).active).toBe(true);
    }
  });
  it("can acquire a new shake axis after an ordinary pickup movement", () => {
    const detector = createCompanionHeldShake(); detector.begin(300, 400, 0);
    for (let time = 16; time <= 160; time += 16) detector.push(300 + time * 2, 400, time);
    for (let tick = 1; tick <= 60; tick++) {
      const time = tick * 1000 / 60; detector.push(620, 400 + wave(time), 160 + time);
    }
    expect(detector.sample(1160).active).toBe(true);
  });
  it("rejects a single fling and one fast return even when their travel is huge", () => {
    for (const point of [(now: number) => ({ x: 100 + now * 2, y: 300 }), (now: number) => ({ x: 100 + wave(now, 800, 400), y: 300 })]) {
      const detector = createCompanionHeldShake();
      expect(path(detector, point).active).toBe(false); expect(detector.consume(800)).toBe(false);
    }
  });
  it("rejects tiny high-frequency jitter, slow broad strokes and a perimeter detour", () => {
    const square = (now: number) => {
      const leg = Math.floor(now / 200) % 4, p = now % 200 / 200;
      return leg === 0 ? { x: 500 + p * 100, y: 400 } : leg === 1 ? { x: 600, y: 400 + p * 100 }
        : leg === 2 ? { x: 600 - p * 100, y: 500 } : { x: 500, y: 500 - p * 100 };
    };
    for (const point of [(now: number) => ({ x: 500 + wave(now, 6, 25), y: 400 }), (now: number) => ({ x: 500 + wave(now, 100, 500), y: 400 }), square]) {
      expect(path(createCompanionHeldShake(), point, 2400, 120).active).toBe(false);
    }
  });
  it("requires real duration even for extremely fast repeated strokes", () => {
    const detector = createCompanionHeldShake();
    expect(path(detector, now => ({ x: 500 + wave(now, 100, 40), y: 400 }), 320, 240).active).toBe(false);
    expect(detector.consume(320)).toBe(false);
  });
  it("recognizes sustained fast reversals after450ms even when the latest three strokes are shorter", () => {
    const detector = createCompanionHeldShake(); detector.begin(500, 400, 0);
    let firstActive = Infinity;
    for (let tick = 1; tick <= 480; tick++) {
      const time = tick * 1000 / 240;
      detector.push(500 + wave(time, 100, 100), 400, time);
      if (detector.sample(time).active) firstActive = Math.min(firstActive, time);
      if (time < 450) expect(detector.sample(time).active).toBe(false);
    }
    expect(firstActive).toBeGreaterThanOrEqual(450); expect(firstActive).toBeLessThan(650);
    expect(detector.sample(2000).active).toBe(true); expect(detector.consume(2000)).toBe(true);
  });
  it("ignores duplicate/backward/invalid timestamps and cannot create a shake from an event burst", () => {
    const detector = createCompanionHeldShake(); detector.begin(500, 400, 100);
    for (let i = 0; i < 1000; i++) {
      detector.push(i % 2 ? 100 : 1000, 400, 100);
      detector.push(i % 2 ? 100 : 1000, 400, 99);
      detector.push(NaN, 400, 100 + i); detector.push(500, Infinity, 100 + i); detector.push(500, 400, NaN);
    }
    expect(detector.sample(120)).toEqual({ active: false, phase: 0 });
    expect(detector.sample(NaN)).toEqual({ active: false, phase: 0 });
    expect(detector.consume(120)).toBe(false);
  });
  it("keeps a genuine path unchanged when duplicate/backward events are interleaved", () => {
    const detector = createCompanionHeldShake(); detector.begin(500, 400, 0);
    for (let tick = 1; tick <= 48; tick++) {
      const time = tick * 1000 / 60, point = horizontal(time);
      detector.push(point.x, point.y, time);
      detector.push(1000, 100, time); detector.push(100, 900, time - 1);
    }
    const reference = path(createCompanionHeldShake(), horizontal);
    expect(detector.sample(800)).toEqual(reference);
  });
  it("breaks partial reversal history across missing-input gaps instead of catching up", () => {
    const detector = createCompanionHeldShake(); path(detector, horizontal, 600);
    detector.push(800, 300, 10000);
    for (let tick = 1; tick <= 12; tick++) detector.push(800 + wave(tick * 1000 / 60), 300, 10000 + tick * 1000 / 60);
    expect(detector.sample(10200).active).toBe(false); expect(detector.consume(10200)).toBe(false);
  });
  it("preserves an earned latch across a release gap without refreshing its original deadline", () => {
    for (const point of [{ x: 500, y: 400 }, { x: 850, y: 650 }]) {
      const detector = createCompanionHeldShake(); path(detector, horizontal);
      detector.push(point.x, point.y, 1100);
      expect(detector.sample(1100).active).toBe(true);
      expect(detector.consume(1100)).toBe(true); expect(detector.consume(1101)).toBe(false);
      const expired = createCompanionHeldShake(); path(expired, horizontal);
      expired.push(point.x, point.y, 1500);
      expect(expired.sample(1800)).toEqual({ active: false, phase: 0 });
      expect(expired.consume(1800)).toBe(false);
    }
  });
  it("latches for one second without sample/zero motion prolonging the reaction", () => {
    const detector = createCompanionHeldShake(); path(detector, horizontal);
    expect(detector.sample(900).active).toBe(true);
    for (let now = 816; now <= 2000; now += 16) { detector.push(500, 400, now); detector.sample(now); }
    expect(detector.sample(2000)).toEqual({ active: false, phase: 0 });
    expect(detector.consume(2000)).toBe(false);
  });
  it("refreshes the latch only on further qualified turns and consumes at most once per gesture", () => {
    const detector = createCompanionHeldShake(); path(detector, horizontal, 2400);
    expect(detector.sample(2400).active).toBe(true);
    expect(detector.sample(2300).active).toBe(false);
    expect(detector.consume(2400)).toBe(true);
    for (let tick = 145; tick <= 240; tick++) detector.push(horizontal(tick * 1000 / 60).x, 400, tick * 1000 / 60);
    expect(detector.consume(4000)).toBe(false); expect(detector.sample(4000).active).toBe(false);
    expect(path(detector, horizontal, 800, 60, 5000).active).toBe(true);
    expect(detector.consume(5800)).toBe(true);
  });
  it("reset and a fresh begin discard both the previous latch and partial history", () => {
    const detector = createCompanionHeldShake(); path(detector, horizontal); detector.reset();
    expect(detector.consume(800)).toBe(false);
    detector.begin(500, 400, 1000); detector.push(600, 400, 1100);
    expect(detector.sample(1100).active).toBe(false);
    detector.begin(NaN, 400, 1200); expect(detector.sample(1200).active).toBe(false);
    expect(path(detector, horizontal, 800, 120, 2000).active).toBe(true);
  });
});
