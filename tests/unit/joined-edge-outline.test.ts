import { describe, expect, it } from "vitest";
import { loopOrder, openOutlineParts } from "@/lib/calendar/use-equal-chain-heights";

// 맞닿은 변 규칙 하나(2026-11-19 소유자): 토→일 줄바뀜 끝의 세로변은 고른 테두리·손 올림 빛·개미 행렬 모두 긋지 않는다.
const rect = (l: number, r: number, t: number, b: number, sl?: "L", sr?: "R") => [
  { x: l, y: t, r: 0, side: sl },
  { x: r, y: t, r: 0, side: sr },
  { x: r, y: b, r: 0, side: sr },
  { x: l, y: b, r: 0, side: sl }
];

describe("openOutlineParts", () => {
  it("a block with no joined end stays one closed outline", () => {
    const parts = openOutlineParts(rect(0, 10, 0, 5));
    expect(parts).toHaveLength(1);
    expect(parts[0].start).toBeNull();
    expect(parts[0].d.endsWith("Z")).toBe(true);
  });
  it("Saturday's block drops its right edge; Sunday's drops its left edge", () => {
    const sat = openOutlineParts(rect(0, 10, 0, 5, undefined, "R"));
    expect(sat).toEqual([{ d: "M10.00,5.00 L0.00,5.00 Q0.00,5.00 0.00,5.00 L0.00,0.00 Q0.00,0.00 0.00,0.00 L10.00,0.00 Q10.00,0.00 10.00,0.00", start: "R" }]);
    const sun = openOutlineParts(rect(0, 10, 20, 25, "L"));
    expect(sun).toHaveLength(1);
    expect(sun[0].start).toBe("L");
    expect(sun[0].d.startsWith("M0.00,20.00")).toBe(true);
    expect(sun[0].d.endsWith("0.00,25.00")).toBe(true);
  });
  it("a full middle week splits into its top and bottom only", () => {
    const parts = openOutlineParts(rect(0, 10, 0, 5, "L", "R"));
    expect(parts.map((p) => p.start).sort()).toEqual(["L", "R"]);
  });
});

describe("loopOrder — one loop over the rows of a wrapped run", () => {
  it("first row, middle tops, last row, middle bottoms reversed", () => {
    const first = [{ d: "first", start: "R" as const }];
    const mid1 = [{ d: "m1-bottom", start: "R" as const }, { d: "m1-top", start: "L" as const }];
    const mid2 = [{ d: "m2-bottom", start: "R" as const }, { d: "m2-top", start: "L" as const }];
    const last = [{ d: "last", start: "L" as const }];
    expect(loopOrder([first, mid1, mid2, last])).toEqual(["first", "m1-top", "m2-top", "last", "m2-bottom", "m1-bottom"]);
    expect(loopOrder([first, last])).toEqual(["first", "last"]);
  });
});
