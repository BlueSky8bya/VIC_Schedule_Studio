import { describe, expect, it } from "vitest";
import { premiereFocusMotion } from "@/lib/ui/premiere/focus-motion";
import { splitEventTitle, splitEventTitleOutline } from "@/lib/calendar/month";

describe("premiere focus", () => {
  it("uses bounded aperiodic drift until calm and retreats continuously from 10 to 2", () => {
    expect(premiereFocusMotion(60000)).toEqual({ x: 0, y: 0, tilt: 0, retreat: 0 });
    const positions = [];
    for (let ms = 55000; ms > 12000; ms -= 123) {
      const value = premiereFocusMotion(ms);
      expect(Math.abs(value.x)).toBeLessThan(2.2); expect(Math.abs(value.y)).toBeLessThan(2.2);
      positions.push(value.x);
    }
    expect(new Set(positions).size).toBe(positions.length);
    for (const ms of [10000, 8000, 5000, 2000, 0]) {
      const value = premiereFocusMotion(ms);
      expect(value.x).toBe(0); expect(value.y).toBe(0);
    }
    expect(premiereFocusMotion(10000).retreat).toBe(0);
    expect(premiereFocusMotion(6000).retreat).toBeCloseTo(.5);
    expect(premiereFocusMotion(2000).retreat).toBe(1);
  });
  it("preserves calendar title semantics and bounded subtopic indentation", () => {
    const title = "제목\n  부제\n    세부\n\t\t\t깊은 내용\n\n  마지막";
    const outline = splitEventTitleOutline(title);
    expect(outline).toEqual({ main: "제목", subs: [{ text: "부제", depth: 0 }, { text: "세부", depth: 1 }, { text: "깊은 내용", depth: 2 }, { text: "마지막", depth: 0 }] });
    expect(splitEventTitle(title)).toEqual({ main: outline.main, subs: outline.subs.map(item => item.text) });
    expect(splitEventTitleOutline("한 줄").subs).toEqual([]);
  });
});
