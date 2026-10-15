import { describe, expect, it } from "vitest";
import { premiereAudienceFrame, premiereAudienceSeat, premiereAudienceSeed, premiereAudienceTiming, premiereCompany } from "@/lib/ui/premiere/company";

describe("premiere company", () => {
  it("retires host/controls and silences music before the ten-second boundary", () => {
    expect(premiereCompany(40000).retire).toBe(0);
    expect(premiereCompany(21000).settle).toBe(0);
    expect(premiereCompany(14000).settle).toBe(1);
    for (const ms of [10500, 10000, 9000, 0, -1000]) {
      const company = premiereCompany(ms);
      expect(company.retire).toBe(1); expect(company.strength).toBe(0);
    }
  });
  it("makes one opening reproducible with distinct individual scores and a different next opening", () => {
    const first = Array.from({ length: 6 }, (_, index) => premiereAudienceSeed(3124, index));
    expect(new Set(first).size).toBe(6);
    expect(first).toEqual(Array.from({ length: 6 }, (_, index) => premiereAudienceSeed(3124, index)));
    expect(first).not.toEqual(Array.from({ length: 6 }, (_, index) => premiereAudienceSeed(3125, index)));
    const traces = first.map(seed => Array.from({ length: 250 }, (_, index) => premiereAudienceFrame(60000 - index * 100, seed)));
    expect(new Set(traces.map(trace => trace.join(","))).size).toBe(6);
    // Pauses and bout lengths differ too, not just one common shifted loop.
    expect(new Set(traces.map(trace => trace.slice(1).filter((frame, index) => frame !== trace[index]).length)).size).toBeGreaterThan(2);
  });
  it("uses native cheer frames without the two reversed-ear cells", () => {
    const frames = new Set<number>();
    for (let ms = 68000; ms > 15000; ms -= 25) for (let index = 0; index < 6; index++) frames.add(premiereAudienceFrame(ms, premiereAudienceSeed(412, index)));
    expect(frames.size).toBe(10); expect(frames.has(9)).toBe(false); expect(frames.has(10)).toBe(false);
    expect(premiereAudienceFrame(NaN, 0)).toBe(15);
  });
  it("staggers complete turns before10.5 and never replays a cheer during quiet", () => {
    const starts = new Set<number>();
    for (let index = 0; index < 6; index++) {
      const seed = premiereAudienceSeed(981, index), timing = premiereAudienceTiming(seed);
      starts.add(timing.turnStart);
      expect(timing.turnStart).toBeGreaterThanOrEqual(13.6); expect(timing.turnStart).toBeLessThan(14.8);
      expect(timing.turnEnd).toBeGreaterThan(10.5); expect(timing.turnEnd).toBeLessThan(timing.turnStart);
      expect(premiereAudienceFrame((timing.turnStart + .001) * 1000, seed)).toBeLessThan(12);
      for (let quarter = 0; quarter < 4; quarter++) {
        const seconds = timing.turnStart - (timing.turnStart - timing.turnEnd) * (quarter + .1) / 4;
        expect(premiereAudienceFrame(seconds * 1000, seed)).toBe(12 + quarter);
      }
      for (const ms of [10500, 10000, 9000, 0, -1000]) expect(premiereAudienceFrame(ms, seed, 300)).toBe(15);
    }
    expect(starts.size).toBe(6);
  });
  it("keeps user cheers finite, independent and reconstructible from the same clock", () => {
    for (let index = 0; index < 6; index++) {
      const seed = premiereAudienceSeed(84, index);
      for (const age of [0, 100, 400, 900, 1499]) {
        const frame = premiereAudienceFrame(40000, seed, age);
        expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 11]).toContain(frame);
        expect(premiereAudienceFrame(40000, seed, age)).toBe(frame);
      }
      expect(premiereAudienceFrame(40000, seed, 1500)).toBe(premiereAudienceFrame(40000, seed));
      const before = premiereAudienceFrame(42000, seed);
      premiereAudienceFrame(8000, seed);
      expect(premiereAudienceFrame(42000, seed)).toBe(before);
    }
  });
  it("gathers each spectator once after turning, with a fixed seated position before eight", () => {
    for (let index = 0; index < 6; index++) {
      const seed = premiereAudienceSeed(543, index), timing = premiereAudienceTiming(seed);
      expect(timing.turnEnd).toBeGreaterThan(timing.seatStart);
      expect(premiereAudienceSeat(10500, index, false, seed)).toEqual({ progress: 0, y: 0, depth: 1 });
      let previous = 0;
      for (let ms = 10500; ms >= 8000; ms -= 25) {
        const seat = premiereAudienceSeat(ms, index, false, seed);
        expect(seat.progress).toBeGreaterThanOrEqual(previous);
        expect(seat.progress).toBeLessThanOrEqual(1);
        expect(Math.abs(seat.y)).toBeLessThanOrEqual(7.25);
        expect(seat.depth).toBeGreaterThanOrEqual(.86);
        previous = seat.progress;
      }
      for (const ms of [8000, 7000, 2000, 0, -5000]) expect(premiereAudienceSeat(ms, index, false, seed)).toEqual({ progress: 1, y: -6, depth: .86 });
    }
  });
  it("uses the current deadline for late entry, return and postponement without a replay state", () => {
    expect(premiereAudienceSeat(9200, 2).progress).toBeGreaterThan(0);
    expect(premiereAudienceSeat(9200, 2).progress).toBeLessThan(1);
    expect(premiereAudienceSeat(30000, 2).progress).toBe(0);
    expect(premiereAudienceSeat(9000, 2, true).progress).toBe(premiereAudienceSeat(9000, 2).progress);
    expect(Math.abs(premiereAudienceSeat(9000, 2, true).y)).toBeLessThan(Math.abs(premiereAudienceSeat(9000, 2).y));
    expect(premiereAudienceSeat(NaN, 0)).toEqual({ progress: 0, y: 0, depth: 1 });
  });
  it("fades watching backs only at5→2 and keeps them invisible atone or on late entry", () => {
    expect(premiereCompany(5100).audienceOpacity).toBe(1);
    expect(premiereCompany(5000).audienceOpacity).toBe(1);
    expect(premiereCompany(3500).audienceOpacity).toBeCloseTo(.5);
    for (const ms of [2000, 1000, 0, -1000]) expect(premiereCompany(ms).audienceOpacity).toBe(0);
    let previous = 1;
    for (let ms = 5000; ms >= 2000; ms -= 20) {
      const opacity = premiereCompany(ms).audienceOpacity;
      expect(opacity).toBeLessThanOrEqual(previous); expect(opacity).toBeGreaterThanOrEqual(0); previous = opacity;
    }
    expect(premiereCompany(Infinity).audienceOpacity).toBe(1);
  });
});
