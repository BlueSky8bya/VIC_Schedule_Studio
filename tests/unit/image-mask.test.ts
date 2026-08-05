import { describe, expect, it } from "vitest";
import {
  ALPHA_MIN,
  boxOf,
  maskFromRgba,
  maskHitsEraser,
  maskHitsRect,
  maskPaintedOutsideRect,
  type AlphaMask
} from "@/lib/broadcast/image-mask";
import type { Stroke } from "@/lib/broadcast/stroke-engine";

// 2026-08-05 사용자 지적: "채우기로 채운 색이, 선택 범위에 안 들어갔는데도 같이 선택된다."
// 채우기 결과는 image 항목이고 그 상자는 '바뀐 픽셀 전체'를 감싼다 — 화면 절반을 채우면 상자도
// 화면 절반이다. 상자로 판정하면 그 안 어디를 긁든(투명한 여백이어도) 통째로 잡혔다.

const img = (l: number, t: number, r: number, b: number): Stroke => ({
  tool: "image",
  layer: "L1",
  color: "#000",
  width: 0,
  src: "data:,",
  points: [
    { x: l, y: t },
    { x: r, y: b }
  ]
});

/** 왼쪽 절반만 칠해진 8×8 마스크(오른쪽 절반은 투명). */
function halfMask(): AlphaMask {
  const a = new Uint8Array(64);
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 4; x += 1) a[y * 8 + x] = 255;
  return { w: 8, h: 8, a };
}

describe("boxOf", () => {
  it("뒤집혀 저장된 2점도 정규화한다", () => {
    expect(boxOf(img(100, 100, 0, 0))).toEqual({ left: 0, top: 0, right: 100, bottom: 100 });
  });
});

describe("maskHitsRect — 상자가 아니라 칠해진 픽셀", () => {
  const mask = halfMask();
  const box = boxOf(img(0, 0, 80, 80));

  it("칠해진 쪽을 긁으면 잡힌다", () => {
    expect(maskHitsRect(mask, box, { left: 5, top: 5, right: 20, bottom: 20 })).toBe(true);
  });
  it("투명한 여백만 긁으면 안 잡힌다(이게 사용자가 본 버그)", () => {
    expect(maskHitsRect(mask, box, { left: 50, top: 5, right: 70, bottom: 20 })).toBe(false);
  });
  it("상자 밖은 안 잡힌다", () => {
    expect(maskHitsRect(mask, box, { left: 200, top: 200, right: 260, bottom: 260 })).toBe(false);
  });
  it("경계에 걸치면 잡힌다(칠해진 칸을 조금이라도 덮으면)", () => {
    expect(maskHitsRect(mask, box, { left: 38, top: 5, right: 45, bottom: 20 })).toBe(true);
  });
  it("납작한 상자(0 크기)는 조용히 아니다", () => {
    expect(maskHitsRect(mask, boxOf(img(10, 10, 10, 10)), { left: 0, top: 0, right: 99, bottom: 99 })).toBe(
      false
    );
  });
  it("옮겨 놓은 그림도 지금 자리 기준으로 판정한다", () => {
    const moved = boxOf(img(100, 0, 180, 80)); // 오른쪽으로 100 이동
    expect(maskHitsRect(mask, moved, { left: 105, top: 5, right: 120, bottom: 20 })).toBe(true);
    expect(maskHitsRect(mask, moved, { left: 5, top: 5, right: 20, bottom: 20 })).toBe(false);
  });
});

describe("maskHitsEraser — 여백만 스친 지우개는 '안 지웠다'", () => {
  const mask = halfMask();
  const box = boxOf(img(0, 0, 80, 80));

  it("칠해진 쪽을 지나면 닿았다", () => {
    expect(maskHitsEraser(mask, box, { points: [{ x: 10, y: 0 }, { x: 10, y: 80 }], width: 8 })).toBe(
      true
    );
  });
  it("투명한 쪽만 지나면 안 닿았다", () => {
    expect(maskHitsEraser(mask, box, { points: [{ x: 70, y: 0 }, { x: 70, y: 80 }], width: 8 })).toBe(
      false
    );
  });
  it("가로지르면 양 끝이 밖이어도 닿는다", () => {
    expect(
      maskHitsEraser(mask, box, { points: [{ x: -50, y: 40 }, { x: 200, y: 40 }], width: 4 })
    ).toBe(true);
  });
  it("점 하나(탭)도 굵기만큼 본다", () => {
    expect(maskHitsEraser(mask, box, { points: [{ x: 41, y: 40 }], width: 6 })).toBe(true);
    expect(maskHitsEraser(mask, box, { points: [{ x: 70, y: 40 }], width: 6 })).toBe(false);
  });
  it("빈 획은 아니다", () => {
    expect(maskHitsEraser(mask, box, { points: [], width: 6 })).toBe(false);
  });
});

describe("maskFromRgba — 줄여도 가는 선이 사라지지 않는다", () => {
  it("칸 안의 최댓값을 쓴다(평균이면 1px 선이 지워진다)", () => {
    const w = 64;
    const h = 64;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y += 1) data[(y * w + 32) * 4 + 3] = 255; // 세로 1px 선
    const mask = maskFromRgba(data, w, h, 8);
    expect(mask.w).toBe(8);
    const col = Math.floor((32 * 8) / 64);
    let found = 0;
    for (let y = 0; y < mask.h; y += 1) if (mask.a[y * mask.w + col] >= ALPHA_MIN) found += 1;
    expect(found).toBe(mask.h); // 모든 행에 선이 남아 있다
  });

  it("상한보다 작은 그림은 그대로", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    data[3] = 255;
    const mask = maskFromRgba(data, 4, 4, 256);
    expect([mask.w, mask.h]).toEqual([4, 4]);
    expect(mask.a[0]).toBe(255);
  });

  it("완전히 투명한 그림은 어디를 긁어도 안 잡힌다", () => {
    const mask = maskFromRgba(new Uint8ClampedArray(16 * 16 * 4), 16, 16, 16);
    expect(maskHitsRect(mask, boxOf(img(0, 0, 100, 100)), { left: 0, top: 0, right: 100, bottom: 100 })).toBe(
      false
    );
  });
});

describe("maskPaintedOutsideRect — 잘라낼 의미가 있나", () => {
  const mask = halfMask(); // 왼쪽 절반만 칠해진 8×8
  const box = boxOf(img(0, 0, 80, 80));

  it("칠해진 부분을 다 감쌌으면 밖에 남는 게 없다(통째 선택)", () => {
    expect(maskPaintedOutsideRect(mask, box, { left: -5, top: -5, right: 85, bottom: 85 })).toBe(false);
    // 왼쪽 절반만 감싸도 그게 칠해진 전부다.
    expect(maskPaintedOutsideRect(mask, box, { left: -5, top: -5, right: 41, bottom: 85 })).toBe(false);
  });

  it("일부만 감쌌으면 밖에 남는다(잘라서 선택)", () => {
    expect(maskPaintedOutsideRect(mask, box, { left: 0, top: 0, right: 20, bottom: 80 })).toBe(true);
    expect(maskPaintedOutsideRect(mask, box, { left: 0, top: 0, right: 80, bottom: 20 })).toBe(true);
  });

  it("투명한 쪽만 감쌌으면 당연히 밖에 남는다", () => {
    expect(maskPaintedOutsideRect(mask, box, { left: 50, top: 0, right: 80, bottom: 80 })).toBe(true);
  });
});
