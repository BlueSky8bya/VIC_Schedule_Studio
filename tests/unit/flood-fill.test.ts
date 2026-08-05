import { describe, expect, it } from "vitest";
import { floodFill, parseHexColor, type PixelBuffer } from "@/lib/broadcast/flood-fill";

// 캔버스 없이 순수 픽셀 버퍼로 검증한다(판서 엔진과 같은 원칙 — DOM 비의존).
function buffer(w: number, h: number): PixelBuffer {
  return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
}
function px(img: PixelBuffer, x: number, y: number): [number, number, number, number] {
  const i = (y * img.width + x) * 4;
  return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]];
}
function set(img: PixelBuffer, x: number, y: number, rgba: [number, number, number, number]) {
  const i = (y * img.width + x) * 4;
  [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]] = rgba;
}
const RED = { r: 255, g: 0, b: 0, a: 255 };
const BLACK: [number, number, number, number] = [0, 0, 0, 255];

describe("parseHexColor", () => {
  it("#rrggbb / #rgb 모두 읽는다", () => {
    expect(parseHexColor("#ff0000")).toEqual(RED);
    expect(parseHexColor("f00")).toEqual(RED);
  });
  it("이상한 값은 null — 색을 지어내 칠하지 않는다", () => {
    expect(parseHexColor("빨강")).toBeNull();
    expect(parseHexColor("#12345")).toBeNull();
  });
});

describe("floodFill — 선 안쪽만 채운다", () => {
  it("빈 칸을 찍으면 그 영역 전체가 칠해진다", () => {
    const img = buffer(4, 4);
    expect(floodFill(img, 1, 1, RED)).toBe(16);
    expect(px(img, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(px(img, 3, 3)).toEqual([255, 0, 0, 255]);
  });

  it("닫힌 선 밖으로 새지 않는다", () => {
    // 5×5 한가운데 3×3 테두리(검정) — 안쪽 1칸만 채워져야 한다.
    const img = buffer(5, 5);
    for (const [x, y] of [
      [1, 1], [2, 1], [3, 1],
      [1, 2], [3, 2],
      [1, 3], [2, 3], [3, 3]
    ] as const) {
      set(img, x, y, BLACK);
    }
    expect(floodFill(img, 2, 2, RED)).toBe(1);
    expect(px(img, 2, 2)).toEqual([255, 0, 0, 255]);
    expect(px(img, 0, 0)).toEqual([0, 0, 0, 0]); // 바깥은 그대로 투명
    expect(px(img, 2, 1)).toEqual([0, 0, 0, 255]); // 선 자체는 안 건드린다
  });

  it("선이 끊겨 있으면 밖으로 샌다(그림판 공통 성질 — 사용자가 알아야 할 동작)", () => {
    const img = buffer(5, 5);
    for (const [x, y] of [
      [1, 1], [2, 1], [3, 1],
      [1, 2], [3, 2],
      [1, 3], [3, 3] // (2,3) 없음 = 아래가 뚫림
    ] as const) {
      set(img, x, y, BLACK);
    }
    expect(floodFill(img, 2, 2, RED)).toBeGreaterThan(1);
    expect(px(img, 0, 4)).toEqual([255, 0, 0, 255]);
  });

  it("이미 그 색이면 아무 일도 안 한다(무한 반복 방지)", () => {
    const img = buffer(3, 3);
    floodFill(img, 1, 1, RED);
    expect(floodFill(img, 1, 1, RED)).toBe(0);
  });

  it("판 밖을 찍으면 0", () => {
    const img = buffer(3, 3);
    expect(floodFill(img, -1, 1, RED)).toBe(0);
    expect(floodFill(img, 3, 0, RED)).toBe(0);
  });

  it("반투명 경계(안티앨리어싱) 밑에 색을 깔아 흰 이음매를 남기지 않는다", () => {
    const img = buffer(3, 1);
    set(img, 1, 0, [0, 0, 0, 128]); // 반투명 검정 = 선의 가장자리
    floodFill(img, 0, 0, RED);
    const seam = px(img, 1, 0);
    expect(seam[3]).toBe(255); // 완전 불투명해진다(밑에 빨강이 깔림)
    expect(seam[0]).toBeGreaterThan(100); // 빨강 성분이 섞여 있다
    expect(seam[0]).toBeLessThan(200); // 그렇다고 선이 사라지지도 않는다
  });

  it("허용 오차보다 크게 다른 색은 경계로 본다", () => {
    const img = buffer(3, 1);
    set(img, 1, 0, [0, 0, 0, 255]);
    expect(floodFill(img, 0, 0, RED, 8)).toBe(1);
  });
});
