import { describe, expect, it } from "vitest";
import { cardAntsPath } from "@/lib/calendar/use-equal-chain-heights";

// 복사 개미 행렬(2026-11-19 소유자): 복사한 그 카드 하나만, 그려진 모양 그대로.
// 둥근 변은 바깥으로 3px 띄우고 둥글게, 이웃과 맞닿은 변은 그 카드 쪽 안으로 1.5px 들여 평평하게(이웃으로 번지지 않는다).
const box = { left: 100, right: 300, top: 50, bottom: 80 };
const nums = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
const xs = (d: string) => nums(d).filter((_, i) => i % 2 === 0);
const ys = (d: string) => nums(d).filter((_, i) => i % 2 === 1);

describe("cardAntsPath", () => {
  it("a free card is a rounded rect 3px outside on every side (same place as .copy-ants)", () => {
    const d = cardAntsPath(box, { joinLeft: false, joinRight: false }, 8);
    expect(Math.min(...xs(d))).toBe(97);
    expect(Math.max(...xs(d))).toBe(303);
    expect(Math.min(...ys(d))).toBe(47);
    expect(Math.max(...ys(d))).toBe(83);
    expect(d).toContain("Q97.00,47.00"); // 둥근 모서리(제어점이 꼭짓점)
  });
  it("a joined right edge stays on the card's own side of the seam and is flat", () => {
    const d = cardAntsPath(box, { joinLeft: false, joinRight: true }, 8);
    expect(Math.max(...xs(d))).toBe(298.5); // 이음(300)을 넘지 않는다
    expect(Math.min(...xs(d))).toBe(97); // 반대쪽은 그대로 둥글게 띄운다
    // 평평한 변의 두 꼭짓점은 반경 0 — 곡선 없이 바로 꺾인다.
    expect(d).toContain("L298.50,47.00 Q298.50,47.00 298.50,47.00");
    expect(d).toContain("L298.50,83.00 Q298.50,83.00 298.50,83.00");
  });
  it("a Sat→Sun wrap end is left open (same joined-edge rule as the selection ring and sheen)", () => {
    const d = cardAntsPath(box, { joinLeft: false, joinRight: true, wrapRight: true }, 8);
    expect(d.startsWith("M298.50,83.00")).toBe(true); // 열린 끝(오른쪽 아래)에서 시작해
    expect(d.trim().endsWith("298.50,47.00")).toBe(true); // 오른쪽 위에서 끝난다 — 그 세로변은 없다
    expect(d).not.toContain("Z");
  });
  it("a middle band piece is flat and inside on both joined sides", () => {
    const d = cardAntsPath(box, { joinLeft: true, joinRight: true }, 8);
    expect(Math.min(...xs(d))).toBe(101.5);
    expect(Math.max(...xs(d))).toBe(298.5);
    expect(Math.min(...ys(d))).toBe(47);
    expect(Math.max(...ys(d))).toBe(83);
  });
});
