// 세계 조명(world/light.ts) — QA 라운드 2의 계약: 점심·맑음은 항등(회귀 해시의 전제), 띠는 목표 순서로 어두워지고,
// 날씨는 저마다 맑음과 다른 채널을 낸다(GRAMMAR §3.2 "3열 미만이면 오버레이"). 상한(틴트 α ≤ .10, 채도 감소 ≤ .7)도 지킨다.
import { describe, expect, it } from "vitest";
import { isNeutralMul, lerpLight, lightOf, NEUTRAL_LIGHT, shadowKey, type Light } from "@/components/shared/ambient/world/light";
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
    // 색도 수치 보간(라운드 3 C#5: 중앙 스위치는 하늘이 "툭" 튀었다) — 양 끝 어느 쪽도 아니고, 4단위 양자화.
    expect(mid.sky).not.toBe(a.sky);
    expect(mid.sky).not.toBe(b.sky);
    expect(mid.sky.split(" ").every((v) => Number(v) % 4 === 0)).toBe(true);
  });
});

// 라운드 4(AMB-T1-03) — 수면 반사 채널·새벽 습기·그림자 재굽기 키.
describe("world/light 라운드 4 — 반사·습기·그림자 키", () => {
  it("빛의 길(reflect)은 점심·아침 0, 노을·밤·새벽·저녁 > 0이고 흐림·비·안개는 어느 띠든 0", () => {
    for (const s of SEASON_KEYS) {
      expect(lightOf("noon", "clear", s).reflect.k).toBe(0);
      expect(lightOf("morning", "clear", s).reflect.k).toBe(0);
      expect(lightOf("dusk", "clear", s).reflect.k).toBeGreaterThan(0.4);
      expect(lightOf("night", "clear", s).reflect.k).toBeGreaterThan(0.3);
      expect(lightOf("dawn", "clear", s).reflect.k).toBeGreaterThan(0.1);
      expect(lightOf("evening", "clear", s).reflect.k).toBeGreaterThan(0.1);
      for (const b of DAY_BANDS) for (const w of ["cloud", "rain", "fog"] as Weather[]) expect(lightOf(b, w, s).reflect.k, `${b}·${w}`).toBe(0);
    }
  });

  it("빛의 길의 가로 자리는 해·달 방위 = 그림자 반대쪽(새벽 오른쪽, 노을 왼쪽) — 화면 안(0.2~0.8)", () => {
    const dawn = lightOf("dawn", "clear", "summer");
    const dusk = lightOf("dusk", "clear", "summer");
    expect(dawn.reflect.x).toBeGreaterThan(0.5);
    expect(dusk.reflect.x).toBeLessThan(0.5);
    for (const b of DAY_BANDS) {
      const x = lightOf(b, "clear", "autumn").reflect.x;
      expect(x).toBeGreaterThan(0.2);
      expect(x).toBeLessThan(0.8);
    }
  });

  it("노을 반사색은 주황이 아니다(오행 규칙: 회장미 — R·G 차 ≤ 40, G·B 차 ≤ 20) · 밤은 청백(B ≥ R)", () => {
    const [r, g, b] = lightOf("dusk", "clear", "autumn").reflect.rgb.split(" ").map(Number);
    expect(r - g).toBeLessThanOrEqual(40);
    expect(Math.abs(g - b)).toBeLessThanOrEqual(20);
    const [nr, , nb] = lightOf("night", "clear", "autumn").reflect.rgb.split(" ").map(Number);
    expect(nb).toBeGreaterThanOrEqual(nr);
  });

  it("새벽·맑음은 옅은 지면 습기(groundFog .2) — 다른 띠의 맑음은 0", () => {
    expect(lightOf("dawn", "clear", "spring").groundFog).toBeCloseTo(0.2);
    for (const b of DAY_BANDS) if (b !== "dawn") expect(lightOf(b, "clear", "spring").groundFog).toBe(0);
  });

  it("shadowKey — 점심·맑음은 NEUTRAL과 같고, 띠마다 다르며, 전이 중 미세 변화(¼ 단위 안)는 같은 키", () => {
    expect(shadowKey(lightOf("noon", "clear", "summer"))).toBe(shadowKey(NEUTRAL_LIGHT));
    const keys = new Set(DAY_BANDS.map((b) => shadowKey(lightOf(b, "clear", "summer"))));
    expect(keys.size).toBeGreaterThanOrEqual(5);
    const a = lightOf("noon", "clear", "summer");
    const near: Light = { ...a, shadow: { dx: 0.05, len: 0.55, alpha: 1.03 } };
    expect(shadowKey(near)).toBe(shadowKey(a));
    expect(shadowKey(lightOf("dusk", "clear", "summer"))).not.toBe(shadowKey(a));
  });

  it("하늘 방향성(reflect.skyK)은 점심·아침 0, 노을이 가장 세고, 흐림·비·안개 0", () => {
    expect(lightOf("noon", "clear", "summer").reflect.skyK).toBe(0);
    expect(lightOf("morning", "clear", "summer").reflect.skyK).toBe(0);
    const dusk = lightOf("dusk", "clear", "summer").reflect.skyK;
    expect(dusk).toBeGreaterThan(lightOf("dawn", "clear", "summer").reflect.skyK);
    expect(dusk).toBeGreaterThan(lightOf("night", "clear", "summer").reflect.skyK);
    for (const w of ["cloud", "rain", "fog"] as Weather[]) expect(lightOf("dusk", w, "summer").reflect.skyK).toBe(0);
  });

  it("lerpLight는 reflect도 보간한다", () => {
    const a = lightOf("noon", "clear", "summer");
    const b = lightOf("dusk", "clear", "summer");
    const m = lerpLight(a, b, 0.5);
    expect(m.reflect.k).toBeGreaterThan(0);
    expect(m.reflect.k).toBeLessThan(b.reflect.k);
    expect(lerpLight(a, b, 1).reflect).toEqual(b.reflect);
  });
});
