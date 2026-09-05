// 세계 조명(world/light.ts) — QA 라운드 2의 계약: 점심·맑음은 항등(회귀 해시의 전제), 띠는 목표 순서로 어두워지고,
// 날씨는 저마다 맑음과 다른 채널을 낸다(GRAMMAR §3.2 "3열 미만이면 오버레이"). 상한(틴트 α ≤ .10, 채도 감소 ≤ .7)도 지킨다.
import { describe, expect, it } from "vitest";
import { isNeutralMul, lerpLight, lightOf, NEUTRAL_LIGHT, type Light } from "@/components/shared/ambient/world/light";
import { DAY_BANDS } from "@/components/shared/ambient/world/time";
import type { Weather } from "@/components/shared/ambient/world/weather";
import { SEASON_KEYS } from "@/components/shared/ambient/registry";

const WEATHERS: Weather[] = ["clear", "cloud", "rain", "snow", "fog", "wind"];
// multiply 색의 밝기 대리값(평균) — 작을수록 어둡다.
const mulMean = (L: Light) => (L.mul[0] + L.mul[1] + L.mul[2]) / 3;
// 조명이 "다른 채널 수" — 하늘·지면·채도·안개·그림자·글린트·바람.
const changedChannels = (a: Light, b: Light) =>
  [
    a.sky !== b.sky || Math.abs(a.skyAlpha - b.skyAlpha) > 0.01,
    mulMean(a) !== mulMean(b),
    Math.abs(a.desat - b.desat) > 0.01,
    Math.abs(a.hazeK - b.hazeK) > 0.01 || a.groundFog !== b.groundFog,
    Math.abs(a.shadow.alpha - b.shadow.alpha) > 0.01,
    a.glint !== b.glint,
    Math.abs(a.wind - b.wind) > 0.01
  ].filter(Boolean).length;

describe("world/light lightOf", () => {
  it("점심·맑음은 모든 계절에서 항등(하늘 0 · multiply 255 · 채도 0 · 안개 1 · 틴트 0 · 지면 안개 0)", () => {
    for (const s of SEASON_KEYS) {
      const L = lightOf("noon", "clear", s);
      expect(L.skyAlpha).toBe(0);
      expect(isNeutralMul(L.mul)).toBe(true);
      expect(L.desat).toBe(0);
      expect(L.hazeK).toBe(1);
      expect(L.hazeRgb).toBe("");
      expect(L.groundFog).toBe(0);
      expect(L.tint.alpha).toBe(0);
    }
  });

  it("지면 노출은 점심 > 아침 > 노을 > 새벽 > 저녁 > 밤 순으로 어두워진다(GRAMMAR §2.1 −2/−3/−6/−9/−16)", () => {
    const m = (b: (typeof DAY_BANDS)[number]) => mulMean(lightOf(b, "clear", "summer"));
    expect(m("noon")).toBeGreaterThan(m("morning"));
    expect(m("morning")).toBeGreaterThan(m("dusk"));
    expect(m("dusk")).toBeGreaterThan(m("dawn"));
    expect(m("dawn")).toBeGreaterThan(m("evening"));
    expect(m("evening")).toBeGreaterThan(m("night"));
  });

  it("아침 ≠ 점심 — 인접 띠 쌍은 둘 이상 채널이 다르다", () => {
    for (let i = 0; i < DAY_BANDS.length - 1; i++) {
      const a = lightOf(DAY_BANDS[i], "clear", "autumn");
      const b = lightOf(DAY_BANDS[i + 1], "clear", "autumn");
      expect(changedChannels(a, b), `${DAY_BANDS[i]}↔${DAY_BANDS[i + 1]}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("밤 지면은 겨울(눈 알베도)이 여름보다 덜 어둡다", () => {
    expect(mulMean(lightOf("night", "clear", "winter"))).toBeGreaterThan(mulMean(lightOf("night", "clear", "summer")));
  });

  it("맑음이 아닌 날씨는 각각 3열 이상 채널이 다르다(오버레이 판정 회피) — 모든 띠·계절", () => {
    for (const s of SEASON_KEYS) {
      for (const b of DAY_BANDS) {
        const clear = lightOf(b, "clear", s);
        for (const wx of WEATHERS) {
          if (wx === "clear") continue;
          expect(changedChannels(clear, lightOf(b, wx, s)), `${s}/${b}/${wx}`).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it("안개는 지면 안개 > 0 이고 시간대 배율을 따른다(새벽 > 점심)", () => {
    expect(lightOf("noon", "fog", "autumn").groundFog).toBeGreaterThan(0);
    expect(lightOf("dawn", "fog", "autumn").groundFog).toBeGreaterThan(lightOf("noon", "fog", "autumn").groundFog);
  });

  it("바람은 wind 1, 맑음은 .08(나무 흔들림 임계 .15 아래 = 정적 유지)", () => {
    expect(lightOf("noon", "wind", "spring").wind).toBe(1);
    expect(lightOf("noon", "clear", "spring").wind).toBeLessThan(0.15);
  });

  it("상한 — 틴트 α ≤ .10, 채도 감소 ≤ .7, 노을은 주황이 아니다(하늘 R 과다 금지: R−B ≤ 40)", () => {
    for (const s of SEASON_KEYS) {
      for (const b of DAY_BANDS) {
        for (const wx of WEATHERS) {
          const L = lightOf(b, wx, s);
          expect(L.tint.alpha).toBeLessThanOrEqual(0.1);
          expect(L.desat).toBeLessThanOrEqual(0.7);
        }
      }
    }
    const dusk = lightOf("dusk", "clear", "autumn").sky.split(" ").map(Number);
    expect(dusk[0] - dusk[2]).toBeLessThanOrEqual(40);
  });

  it("결정적 — 같은 입력은 같은 값", () => {
    expect(lightOf("evening", "rain", "spring")).toEqual(lightOf("evening", "rain", "spring"));
  });
});

describe("world/light lerpLight", () => {
  it("t=0은 a, t=1은 b, 중간은 수치 보간", () => {
    const a = NEUTRAL_LIGHT;
    const b = lightOf("night", "clear", "summer");
    expect(lerpLight(a, b, 0).mul).toEqual(a.mul);
    expect(lerpLight(a, b, 1)).toBe(b);
    const mid = lerpLight(a, b, 0.5);
    expect(mid.mul[0]).toBeGreaterThan(b.mul[0]);
    expect(mid.mul[0]).toBeLessThan(a.mul[0]);
    expect(mid.sky).toBe(b.sky);
  });
});
