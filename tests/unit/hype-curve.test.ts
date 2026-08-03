import { describe, expect, it } from "vitest";
import {
  HYPE_WINDOW_S,
  clamp01,
  hypeChannels,
  hypeCssVars,
  hypeIntensity
} from "@/lib/ui/hype-curve";

const S = (sec: number) => sec * 1000;

describe("hypeIntensity — 연속 강도 곡선", () => {
  it("하이프 창(60초) 밖은 0, 공개 시각 이후는 1", () => {
    expect(hypeIntensity(S(120))).toBe(0);
    expect(hypeIntensity(S(HYPE_WINDOW_S))).toBe(0);
    expect(hypeIntensity(0)).toBe(1);
    expect(hypeIntensity(S(-3))).toBe(1);
  });

  it("계획서 기준점과 일치한다(60/55/45/30/15/8/3/1초)", () => {
    expect(hypeIntensity(S(60))).toBeCloseTo(0, 3);
    expect(hypeIntensity(S(55))).toBeCloseTo(0.08, 3);
    expect(hypeIntensity(S(45))).toBeCloseTo(0.131, 2);
    expect(hypeIntensity(S(30))).toBeCloseTo(0.321, 2);
    expect(hypeIntensity(S(15))).toBeCloseTo(0.615, 2);
    expect(hypeIntensity(S(8))).toBeCloseTo(0.784, 2);
    expect(hypeIntensity(S(3))).toBeCloseTo(0.916, 2);
    expect(hypeIntensity(S(1))).toBeCloseTo(0.972, 2);
  });

  it("남은 시간이 줄수록 단조 증가한다(역행 없음)", () => {
    let prev = -1;
    for (let sec = 61; sec >= 0; sec -= 0.25) {
      const i = hypeIntensity(S(sec));
      expect(i).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = i;
    }
  });

  it("60초 경계에서 점프가 없다(진입이 '켜짐'으로 보이면 안 됨)", () => {
    const before = hypeIntensity(S(60.5));
    const at = hypeIntensity(S(60));
    const after = hypeIntensity(S(59.5));
    expect(Math.abs(at - before)).toBeLessThan(0.005);
    expect(Math.abs(after - at)).toBeLessThan(0.005);
  });

  it("전 구간에서 인접 샘플 차이가 작다(이산 단계 경계 없음)", () => {
    let prev = hypeIntensity(S(61));
    for (let sec = 61; sec >= 0; sec -= 0.1) {
      const cur = hypeIntensity(S(sec));
      expect(cur - prev).toBeLessThan(0.02); // 0.1초당 2% 미만
      prev = cur;
    }
  });

  it("잘못된 입력은 0으로 막는다", () => {
    expect(hypeIntensity(Number.NaN)).toBe(0);
    expect(hypeIntensity(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("hypeChannels — 채널 매핑", () => {
  it("모든 채널이 범위 안이고 단조적이다", () => {
    const at0 = hypeChannels(0);
    const at1 = hypeChannels(1);
    expect(at0.ring1).toBe(0);
    expect(at0.shakePx).toBe(0);
    expect(at0.goldMix).toBe(0);
    expect(at1.ring1).toBeGreaterThan(at0.ring1);
    expect(at1.shakePx).toBeGreaterThan(at0.shakePx);
    expect(at1.goldMix).toBeGreaterThan(at0.goldMix);
    // 주기는 빈도 보간 → 강도가 오를수록 짧아진다
    expect(at1.ringDurationS).toBeLessThan(at0.ringDurationS);
    expect(at1.shakeDurationS).toBeLessThan(at0.shakeDurationS);
    expect(at1.dashDurationS).toBeLessThan(at0.dashDurationS);
  });

  it("2·3번 링은 중반·후반부터 스며든다(초반엔 없음)", () => {
    expect(hypeChannels(0.2).ring2).toBe(0);
    expect(hypeChannels(0.5).ring2).toBeGreaterThan(0);
    expect(hypeChannels(0.5).ring3).toBe(0);
    expect(hypeChannels(0.9).ring3).toBeGreaterThan(0);
  });

  it("clamp01이 범위를 벗어난 입력을 막는다", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(9)).toBe(1);
    expect(hypeChannels(5).intensity).toBe(1);
  });

  it("CSS 변수는 숫자·단위 형식이 유효하다", () => {
    const vars = hypeCssVars(hypeChannels(0.5));
    expect(vars["--hype-i"]).toMatch(/^\d\.\d{3}$/);
    expect(vars["--hy-ring-dur"]).toMatch(/^\d+\.\d{3}s$/);
    expect(vars["--hy-shake-x"]).toMatch(/^\d+\.\d{2}px$/);
  });
});
