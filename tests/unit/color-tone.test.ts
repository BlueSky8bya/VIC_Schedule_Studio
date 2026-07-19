import { describe, expect, it } from "vitest";
import { applyTone, hexToHue, inkContrast, TONE_PRESETS } from "@/lib/tags/color-tone";

describe("color-tone", () => {
  it("applyTone은 색조(hue)를 유지하고 톤만 바꾼다", () => {
    const base = "#2f63d6"; // 파랑(hue ~220)
    const baseHue = hexToHue(base);
    for (const t of TONE_PRESETS) {
      const toned = applyTone(base, t.key);
      // 같은 색조(±2° 허용 — 반올림 오차).
      expect(Math.abs(hexToHue(toned) - baseHue)).toBeLessThan(3);
      expect(/^#[0-9a-f]{6}$/.test(toned)).toBe(true);
    }
  });

  it("같은 색조라도 seed(미세조정색)의 채도가 다르면 톤 결과도 달라진다", () => {
    // 쨍한 빨강 vs 차분한(먼지) 빨강 — 색조는 같지만 채도가 다르다.
    const vividRed = "#e01010";
    const dustyRed = "#b06a6a";
    for (const tone of ["pastel", "soft", "vivid", "deep"] as const) {
      expect(applyTone(vividRed, tone)).not.toBe(applyTone(dustyRed, tone));
    }
    // 그래도 색조는 둘 다 유지된다(빨강 근처).
    expect(hexToHue(applyTone(dustyRed, "pastel"))).toBeLessThan(20);
  });

  it("파스텔은 깊게보다 밝다(대비 잉크가 뒤바뀐다)", () => {
    const pastel = applyTone("#2f63d6", "pastel");
    const deep = applyTone("#2f63d6", "deep");
    expect(inkContrast(pastel).ink).toBe("#0a0a0a"); // 밝은 배경 → 검은 글자
    expect(inkContrast(deep).ink).toBe("#ffffff"); // 어두운 배경 → 흰 글자
  });

  it("inkContrast: 흑/백 자동 잉크 → 불투명 단색은 거의 항상 AA 통과(대비비도 계산)", () => {
    expect(inkContrast("#ffffff")).toMatchObject({ ink: "#0a0a0a", passesAA: true });
    expect(inkContrast("#000000")).toMatchObject({ ink: "#ffffff", passesAA: true });
    const gray = inkContrast("#808080"); // 중간 회색도 검은 글자로 ~5:1 → 통과.
    expect(gray.ink).toBe("#0a0a0a");
    expect(gray.ratio).toBeGreaterThan(4.5);
  });
});
