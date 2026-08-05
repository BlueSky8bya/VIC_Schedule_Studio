import { describe, expect, it } from "vitest";
import { trimSeamEnds } from "@/lib/broadcast/stroke-engine";

// 2026-08-06 사용자 지적: 형광펜을 1자로 긋고 절반만 선택하면 경계에 진한 덩어리가 생기고,
// 선택을 풀어도 그대로 남는다. 원인은 쪼갠 두 조각이 경계점을 공유하고, 각자 둥근 캡
// (반지름 = 굵기/2)을 그려 그 자리만 두 번 칠해지는 것. 반투명(형광펜)에서만 눈에 띈다.
// 끝을 반굵기만큼 물리면 캡이 정확히 경계까지만 닿는다.

const line = (x0: number, x1: number) => [
  { x: x0, y: 0 },
  { x: x1, y: 0 }
];

describe("trimSeamEnds", () => {
  it("잘린 끝만 반굵기 물린다(반대쪽 원래 끝은 그대로)", () => {
    const out = trimSeamEnds(line(0, 100), false, true, 10);
    expect(out[0]).toMatchObject({ x: 0 });
    expect(out[out.length - 1].x).toBeCloseTo(90);
  });

  it("양쪽 다 잘린 조각은 양끝을 물린다", () => {
    const out = trimSeamEnds(line(0, 100), true, true, 10);
    expect(out[0].x).toBeCloseTo(10);
    expect(out[out.length - 1].x).toBeCloseTo(90);
  });

  it("자를 곳이 없으면 그대로", () => {
    const pts = line(0, 100);
    expect(trimSeamEnds(pts, false, false, 10)).toEqual(pts);
  });

  it("굵기가 0이면 손대지 않는다", () => {
    const pts = line(0, 100);
    expect(trimSeamEnds(pts, true, true, 0)).toEqual(pts);
  });

  it("캡보다 짧은 조각은 버린다(이웃 캡이 이미 덮는다)", () => {
    expect(trimSeamEnds(line(0, 8), true, true, 10)).toEqual([]);
    expect(trimSeamEnds(line(0, 12), true, true, 10)).toEqual([]);
  });

  it("여러 점을 지나 물린다(중간 점들을 건너뛴다)", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 40, y: 0 }
    ];
    const out = trimSeamEnds(pts, true, false, 12);
    expect(out[0].x).toBeCloseTo(12);
    expect(out.map((p) => p.x)).toEqual([12, 40]);
  });

  it("필압도 보간한다 — 물린 자리에서 굵기가 안 튄다", () => {
    const out = trimSeamEnds(
      [
        { x: 0, y: 0, p: 0 },
        { x: 100, y: 0, p: 1 }
      ],
      true,
      false,
      50
    );
    expect(out[0].p).toBeCloseTo(0.5);
  });

  it("원본을 건드리지 않는다(되돌리기 스냅샷 보호)", () => {
    const pts = line(0, 100);
    trimSeamEnds(pts, true, true, 10);
    expect(pts).toEqual(line(0, 100));
  });
});
