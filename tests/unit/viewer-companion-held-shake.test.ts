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
function ellipse(now: number, radiusX = 70, radiusY = 70, period = 480, direction = 1, rotation = 0): Point {
  const angle = direction * now / period * Math.PI * 2, x = radiusX * Math.cos(angle), y = radiusY * Math.sin(angle);
  return { x: 500 + x * Math.cos(rotation) - y * Math.sin(rotation), y: 400 + x * Math.sin(rotation) + y * Math.cos(rotation) };
}

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
  it("recognizes three gentler70px half-strokes at30/60/120/240Hz", () => {
    const samples = [30, 60, 120, 240].map(rate => {
      const detector = createCompanionHeldShake();
      const result = path(detector, now => ({ x: 500 + wave(now, 70, 200), y: 400 }), 600, rate);
      expect(result.active).toBe(true); expect(detector.consume(600)).toBe(true);
      expect(detector.consume(601)).toBe(false);
      return result;
    });
    samples.forEach(sample => expect(sample.phase).toBeCloseTo(samples[0].phase, 9));
  });
  it("needs only three short strokes but still waits for280ms of real movement", () => {
    for (const rate of [30, 60, 120, 240]) {
      const detector = createCompanionHeldShake();
      expect(path(detector, now => ({ x: 500 + wave(now, 60, 100), y: 400 }), 300, rate).active).toBe(true);
    }
  });
  it("accepts vertical and diagonal reversals, not just horizontal gestures", () => {
    for (const point of [(now: number) => ({ x: 500, y: 400 + wave(now) }), (now: number) => ({ x: 500 + wave(now) * .8, y: 400 + wave(now) * .6 })]) {
      expect(path(createCompanionHeldShake(), point).active).toBe(true);
    }
  });
  it.each([30, 60, 120, 240])("recognizes vigorous clockwise and counterclockwise circles at%dHz", rate => {
    for (const direction of [-1, 1]) for (const period of [320, 480, 640]) {
      const detector = createCompanionHeldShake();
      expect(path(detector, now => ellipse(now, 70, 70, period, direction), 1800, rate).active).toBe(true);
      expect(detector.consume(1800)).toBe(true); expect(detector.consume(1801)).toBe(false);
    }
  });
  it.each([30, 60, 120, 240])("accepts thin and rotated ellipses without requiring a repeated heading at%dHz", rate => {
    for (const [radiusX, radiusY, period, rotation] of [[100, 18, 600, 0], [90, 22, 600, Math.PI / 4], [35, 80, 400, Math.PI / 5]]) {
      expect(path(createCompanionHeldShake(), now => ellipse(now, radiusX, radiusY, period, -1, rotation), 1800, rate).active).toBe(true);
    }
  });
  it.each([30, 60, 120, 240])("accepts vigorous smooth vertical, diagonal and irregular paths at%dHz", rate => {
    const paths = [
      (now: number) => ({ x: 500, y: 400 + 55 * Math.sin(now / 400 * Math.PI * 2) }),
      (now: number) => { const d = 65 * Math.sin(now / 400 * Math.PI * 2); return { x: 500 + d * .6, y: 400 + d * .8 }; },
      (now: number) => { const angle = now / 520 * Math.PI * 2; return { x: 500 + 70 * Math.sin(angle) + 10 * Math.sin(3 * angle), y: 400 + 50 * Math.sin(2 * angle + .3) }; },
    ];
    for (const point of paths) expect(path(createCompanionHeldShake(), point, 1800, rate).active).toBe(true);
  });
  it("rejects tiny circles, slow broad loops, an open arc and ordinary winding transport", () => {
    const paths = [
      { duration: 1800, point: (now: number) => ellipse(now, 5, 5, 80) },
      { duration: 1800, point: (now: number) => ellipse(now, 14, 14, 320) },
      { duration: 8000, point: (now: number) => ellipse(now, 80, 60, 4000) },
      { duration: 800, point: (now: number) => ellipse(now, 240, 160, 2600) },
      { duration: 1800, point: (now: number) => ({ x: 250 + now * .4, y: 400 + 12 * Math.sin(now / 180) }) },
      { duration: 1800, point: () => ({ x: 500, y: 400 }) },
    ];
    for (const { point, duration } of paths) {
      const detector = createCompanionHeldShake();
      expect(path(detector, point, duration, 120).active).toBe(false);
      expect(detector.consume(duration)).toBe(false);
    }
  });
  it("cannot turn a sub280ms circular burst into a shake by holding still afterward", () => {
    const detector = createCompanionHeldShake(), point = (now: number) => ellipse(now, 70, 60, 80);
    expect(path(detector, point, 240, 240).active).toBe(false);
    const stopped = point(240);
    for (let now = 256; now <= 2000; now += 16) {
      detector.push(stopped.x, stopped.y, now); expect(detector.sample(now).active).toBe(false);
    }
    expect(detector.consume(2000)).toBe(false);
  });
  it("keeps circular evidence finite across gaps, expiry, consume, reset and a fresh pickup", () => {
    const detector = createCompanionHeldShake(), circle = (now: number) => ellipse(now);
    expect(path(detector, circle, 1800).active).toBe(true);
    const stopped = circle(1800); detector.push(stopped.x, stopped.y, 2100);
    expect(detector.sample(2100).active).toBe(true);
    expect(detector.sample(3000).active).toBe(false); expect(detector.consume(3000)).toBe(false);
    expect(path(detector, circle, 1800, 60, 4000).active).toBe(true);
    expect(detector.consume(5800)).toBe(true); expect(detector.consume(5801)).toBe(false);
    for (let now = 5816; now <= 7000; now += 16) { const p = circle(now); detector.push(p.x, p.y, now); }
    expect(detector.sample(7000).active).toBe(false);
    expect(path(detector, circle, 1800, 60, 8000).active).toBe(true); detector.reset();
    expect(detector.sample(9800).active).toBe(false);
    expect(path(detector, circle, 240, 120, 10000).active).toBe(false);
    detector.push(500, 400, 11000);
    for (let now = 11016; now <= 11192; now += 16) { const p = circle(now - 11000); detector.push(p.x, p.y, now); }
    expect(detector.sample(11200).active).toBe(false);
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
    expect(path(detector, now => ({ x: 500 + wave(now, 100, 40), y: 400 }), 240, 240).active).toBe(false);
    expect(detector.consume(240)).toBe(false);
  });
  it("recognizes sustained fast reversals after280ms even when the latest two strokes are shorter", () => {
    const detector = createCompanionHeldShake(); detector.begin(500, 400, 0);
    let firstActive = Infinity;
    for (let tick = 1; tick <= 480; tick++) {
      const time = tick * 1000 / 240;
      detector.push(500 + wave(time, 100, 100), 400, time);
      if (detector.sample(time).active) firstActive = Math.min(firstActive, time);
      if (time < 280) expect(detector.sample(time).active).toBe(false);
    }
    expect(firstActive).toBeGreaterThanOrEqual(280); expect(firstActive).toBeLessThan(450);
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
    const detector = createCompanionHeldShake();
    expect(path(detector, horizontal, 300).active).toBe(false);
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
