import { describe, expect, it } from "vitest";
import { shortestCompanionHomeRoute } from "@/lib/ui/viewer-companion/home-route";
import type { Platform } from "@/lib/ui/viewer-companion/brain";

describe("a room moving below the current route", () => {
  const start: Platform = { id: "date-35", kind: "date", x: 380, width: 60, y: 421 };
  const seat: Platform = { id: "companion-home", kind: "date", x: 110, width: 20, y: 683 };
  const floor: Platform = { id: "companion-home-floor", kind: "floor", manualOnly: true, x: 65, width: 140, y: 707 };
  const from = { x: 392, y: start.y, platformId: start.id }, to = { x: 120, y: seat.y, platformId: seat.id };
  it("finishes a safe bounded descent to the real room floor after reflow", () => {
    expect(shortestCompanionHomeRoute(from, to, [start, seat, floor], true)).toBeNull();
    const recovery = shortestCompanionHomeRoute(from, to, [start, seat, floor], true, true);
    expect(recovery).not.toBeNull(); expect(recovery!.some(step => step.target.platformId === floor.id)).toBe(true);
    expect(recovery!.at(-1)!.target.platformId).toBe(seat.id);
  });
  it("reserves the room floor within the existing200-platform budget", () => {
    const clutter = Array.from({ length: 220 }, (_, index): Platform => ({ id: `unrelated-${index}`, kind: "date", x: 2000, y: 100, width: 20 }));
    expect(shortestCompanionHomeRoute(from, to, [start, seat, ...clutter, floor], true, true)).not.toBeNull();
  });
  it("does not invent the same extended drop for ordinary ledges or a distant/too-low room", () => {
    expect(shortestCompanionHomeRoute(from, to, [start, seat, { ...floor, id: "ordinary", manualOnly: false }], true, true)).toBeNull();
    expect(shortestCompanionHomeRoute(from, to, [start, seat, { ...floor, y: 900 }], true, true)).toBeNull();
  });
});
