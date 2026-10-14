import { describe, expect, it } from "vitest";
import { premiereAudienceFrame, premiereAudienceSeat, premiereCompany } from "@/lib/ui/premiere/company";

describe("premiere company and original score", () => {
  it("retires host/controls and silences music before the ten-second boundary", () => {
    expect(premiereCompany(40000).retire).toBe(0);
    expect(premiereCompany(21000).settle).toBe(0);
    expect(premiereCompany(14000).settle).toBe(1);
    for (const ms of [10500, 10000, 9000, 0, -1000]) {
      const company = premiereCompany(ms);
      expect(company.retire).toBe(1); expect(company.strength).toBe(0);
    }
  });
  it("plays actual cheer frames, omits reversed ears, then settles to an immutable watching pose", () => {
    const frames = new Set<number>();
    for (let ms = 60000; ms > 13000; ms -= 100) frames.add(premiereAudienceFrame(ms, 1.7));
    expect(frames.size).toBe(10); expect(frames.has(9)).toBe(false); expect(frames.has(10)).toBe(false);
    expect([12500, 12000, 11500, 11000, 10500, 9000, 0].map(ms => premiereAudienceFrame(ms, 2))).toEqual([12, 13, 14, 15, 15, 15, 15]);
    expect(premiereAudienceFrame(9000, 2, 300)).toBe(15);
    expect(premiereAudienceFrame(40000, 0, 0)).toBe(0);
    expect(premiereAudienceFrame(40000, 0, 400)).toBe(4);
    expect(premiereAudienceFrame(NaN, 0)).toBe(15);
  });
  it("gathers each spectator once after turning, with a fixed seated position before eight", () => {
    for (let index = 0; index < 6; index++) {
      expect(premiereAudienceSeat(10500, index)).toEqual({ progress: 0, y: 0, depth: 1 });
      let previous = 0;
      for (let ms = 10500; ms >= 8000; ms -= 25) {
        const seat = premiereAudienceSeat(ms, index);
        expect(seat.progress).toBeGreaterThanOrEqual(previous);
        expect(seat.progress).toBeLessThanOrEqual(1);
        expect(Math.abs(seat.y)).toBeLessThanOrEqual(7.25);
        expect(seat.depth).toBeGreaterThanOrEqual(.86);
        previous = seat.progress;
      }
      for (const ms of [8000, 7000, 2000, 0, -5000]) expect(premiereAudienceSeat(ms, index)).toEqual(premiereAudienceSeat(8000, index));
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
});
