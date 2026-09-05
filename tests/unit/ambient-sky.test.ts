// 하늘(world/sky.ts, QA 라운드 5) — 계절 × 날씨 팔레트의 계약과 달 위상(실제 음력)의 정확성.
import { describe, expect, it } from "vitest";
import { moonLit, moonPhase, skyPalette } from "@/components/shared/ambient/world/sky";
import { SEASON_KEYS } from "@/components/shared/ambient/registry";

const lum = (rgb: string) => {
  const [r, g, b] = rgb.split(" ").map(Number);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const blue = (rgb: string) => {
  const [r, , b] = rgb.split(" ").map(Number);
  return b - r;
};

describe("world/sky skyPalette", () => {
  it("맑음은 계절마다 다르고 가을이 가장 깊은 파랑(천고마비) — 꼭대기 청색 편차 가을 > 여름 > 봄 ≥ 겨울", () => {
    const b = (s: (typeof SEASON_KEYS)[number]) => blue(skyPalette(s, "clear").top);
    expect(b("autumn")).toBeGreaterThan(b("summer"));
    expect(b("summer")).toBeGreaterThan(b("spring"));
    expect(b("spring")).toBeGreaterThanOrEqual(b("winter") - 2);
    // 위가 아래보다 짙다(높은 하늘).
    for (const s of SEASON_KEYS) expect(lum(skyPalette(s, "clear").top)).toBeLessThan(lum(skyPalette(s, "clear").hz));
  });

  it("흐림·비·눈은 구름 덮개 ≥ .8, 비가 가장 어둡다; 바람은 새털구름; **하늘은 어느 날씨에도 완전히 비지 않는다**", () => {
    for (const s of SEASON_KEYS) {
      expect(skyPalette(s, "cloud").cover).toBeGreaterThanOrEqual(0.8);
      expect(skyPalette(s, "rain").cover).toBeGreaterThanOrEqual(0.9);
      expect(skyPalette(s, "snow").cover).toBeGreaterThanOrEqual(0.7);
      expect(lum(skyPalette(s, "rain").top)).toBeLessThan(lum(skyPalette(s, "cloud").top));
      expect(lum(skyPalette(s, "cloud").top)).toBeLessThan(lum(skyPalette(s, "clear").top) + 40);
      expect(skyPalette(s, "wind").cirrus).toBe(true);
      // 2026-09-06 라운드 7(검토 A): 하늘을 26%로 넓히자 맑음·안개 6장이 **구름 0개·고주파 0.0%의 무지 판**이 됐다.
      // 이제 모든 날씨에 덮개 하한이 있다 — 안개는 아주 옅은 저층운, 맑음은 계절별로 성기게.
      expect(skyPalette(s, "fog").cover).toBeGreaterThan(0);
      expect(skyPalette(s, "clear").cover).toBeGreaterThan(0);
      expect(skyPalette(s, "clear").cloud).not.toBeNull();
    }
    // 가을 맑음이 가장 성기다(천고마비).
    expect(skyPalette("autumn", "clear").cover).toBeLessThan(skyPalette("summer", "clear").cover);
  });

  it("팔레트는 오행 규칙 — 선명한 주황·노랑 없음(모든 색 R ≤ G + 12)", () => {
    for (const s of SEASON_KEYS) for (const w of ["clear", "cloud", "rain", "snow", "fog", "wind"] as const) {
      const p = skyPalette(s, w);
      for (const c of [p.top, p.hz, ...(p.cloud ?? [])]) {
        const [r, g] = c.split(" ").map(Number);
        expect(r, `${s}·${w} ${c}`).toBeLessThanOrEqual(g + 12);
      }
    }
  });
});

describe("world/sky moonPhase(실제 음력)", () => {
  it("기준 삭(2000-01-06)은 0 근처, 보름은 .5 근처, 삭망월 뒤 다시 0", () => {
    const p0 = moonPhase(2000, 1, 6); // 기준 삭은 18:14 UTC — KST 정오 기준이면 직전(.995)
    expect(Math.min(p0, 1 - p0)).toBeLessThan(0.03);
    expect(Math.abs(moonPhase(2000, 1, 21) - 0.5)).toBeLessThan(0.04);
    const p = moonPhase(2000, 2, 5); // +30일 ≈ 삭 + .016
    expect(Math.min(p, 1 - p)).toBeLessThan(0.05);
  });

  it("실제 기록: 2024-04-08 개기일식(삭) · 2025-10-07 보름(추석 다음날)·2026-01-03 보름", () => {
    const p1 = moonPhase(2024, 4, 8);
    expect(Math.min(p1, 1 - p1)).toBeLessThan(0.04);
    expect(Math.abs(moonPhase(2025, 10, 7) - 0.5)).toBeLessThan(0.05);
    expect(Math.abs(moonPhase(2026, 1, 3) - 0.5)).toBeLessThan(0.05);
  });

  it("moonLit: 삭 0 · 보름 1 · 반달 .5", () => {
    expect(moonLit(0)).toBeCloseTo(0);
    expect(moonLit(0.5)).toBeCloseTo(1);
    expect(moonLit(0.25)).toBeCloseTo(0.5);
    expect(moonLit(0.75)).toBeCloseTo(0.5);
  });
});
