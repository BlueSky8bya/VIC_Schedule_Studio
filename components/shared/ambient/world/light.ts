// 세계 조명(2026-09-05, QA 라운드 2 — AMB-T1-01·D3-01·W1-01/02의 공통 입구).
// 라운드 1 검사자 C의 실측: 시간대 = 화면 전체에 옅은 색 **한 겹**(`time.ts LIGHT`)이라 아침=점심(α 0)이고 지면 밝기차가
// 목표의 1/10(새벽 −0.6·밤 −7.2 L*, 목표 −6/−16), 날씨는 16 시나리오 전부 맑음과 픽셀 동일(흐림 16/16 해시 일치).
// 이 파일은 (시간대 × 날씨 × 계절) → **여섯 채널**을 낸다(SEASON_TIME_WEATHER_GRAMMAR §0·§2.1·§3.2):
//   ① 하늘/지평선 색(sky 오버레이) ② 지면 노출(multiply 색 = ΔL + 색온도) ③ 채도(saturation 블렌드) ④ 대기 안개(색·배율·지면 안개 띠)
//   ⑤ 그림자(방향·길이·농도 — 장면의 발밑 그림자가 읽는다) ⑥ 글린트/반사 배율. 마지막에 옛 틴트를 **옅게**(α ≤ .10) 한 겹.
// 엔진(scene-engine.ts drawOnce)이 장면 위에 순서대로 칠하고, 장면은 `currentLight()`로 그림자·바람·글린트를 읽는다.
// **점심·맑음은 중립**(모든 채널이 항등) — 옛 파이프라인과 픽셀이 같아야 회귀 해시가 유효하다.
// 값은 상대값이라 바이옴의 기본 색·형태는 어떤 조합에서도 남는다(원칙 3 "과장 금지", 밤 하한).

import type { SeasonKey } from "@/components/shared/ambient/registry";
import type { DayBand } from "./time";
import type { Weather } from "./weather";

export type Light = {
  /** 하늘·지평선 오버레이 색(rgb "r g b")과 α — 위에서 지평선 아래 16%까지 사라지는 그라데이션. */
  sky: string;
  skyAlpha: number;
  /** 대기 원근 안개 색·알파 배율(1 = 계절 기본 HAZE_ALPHA). */
  hazeRgb: string;
  hazeK: number;
  /** 지면 안개 띠(안개 날씨) 0~1 — 후경·중경·전경 누적 + 발치 띠. */
  groundFog: number;
  /** 지면 노출 — multiply 색(255 255 255 = 항등). 어두울수록 작고, 색으로 색온도를 준다(밤 = 남청회, 노을 = 회장미). */
  mul: [number, number, number];
  /** 채도 감소 0~1(0 = 항등). */
  desat: number;
  /** 마지막 색 보정 한 겹(옛 LIGHT 틴트, 상한 .10). */
  tint: { rgb: string; alpha: number };
  /** 그림자 — dx: 해 반대쪽(−1 = 왼쪽/서 … +1 = 오른쬭/동), len: 몸 높이 대비 길이 배(점심 .5), alpha: 농도 배(점심 1). */
  shadow: { dx: number; len: number; alpha: number };
  /** 수면 글린트·반사 배(점심 1, 흐림·비·안개 0). */
  glint: number;
  /** 바람 0~1 — 입자층·나무 흔들림·풀 진행파가 읽는다(맑음 .08). */
  wind: number;
};

export const NEUTRAL_LIGHT: Light = {
  sky: "255 255 250",
  skyAlpha: 0,
  hazeRgb: "",
  hazeK: 1,
  groundFog: 0,
  mul: [255, 255, 255],
  desat: 0,
  tint: { rgb: "255 255 250", alpha: 0 },
  shadow: { dx: 0, len: 0.5, alpha: 1 },
  glint: 1,
  wind: 0.08
};

type BandRow = {
  sky: string;
  skyAlpha: number;
  hazeK: number;
  mul: [number, number, number];
  desat: number;
  tint: { rgb: string; alpha: number };
  shadow: { dx: number; len: number; alpha: number };
  glint: number;
};

// 하늘 오버레이 색은 GRAMMAR 색조의 **밝은 판**(L을 여기서 떨어뜨리면 하늘이 ① 봉우리보다 어두워져 산 층 순서가 뒤집힌다 — 라운드 2
// 실측: 밤 하늘↔① 4.7 → 2.4). 명도는 multiply가, 오버레이는 색조만 맡는다. 틴트 rgb는 원래 색조 그대로(옅다).
// 시간대 표(GRAMMAR §2.1). multiply 값은 지면 ΔL 목표(−6/−2/0/−3/−9/−16)를 sRGB 배율로 옮긴 것:
//   ΔL −16 ≈ 휘도 ×.48 ≈ 8bit ×.72 · −9 ≈ ×.84 · −6 ≈ ×.89 · −3 ≈ ×.945 · −2 ≈ ×.963. 색은 오행 규칙 — 새벽·저녁·밤은 청회,
//   노을은 회장미(주황 금지: R만 남기고 G·B를 조금 덜어 "따뜻한 회색"까지), 아침은 크림.
const BAND: Record<DayBand, BandRow> = {
  dawn: {
    sky: "140 150 178",
    skyAlpha: 0.34,
    hazeK: 1.6,
    mul: [216, 224, 238],
    desat: 0.14,
    tint: { rgb: "118 128 158", alpha: 0.05 },
    shadow: { dx: -1, len: 1.6, alpha: 0.55 },
    glint: 0
  },
  morning: {
    sky: "250 250 245",
    skyAlpha: 0.16,
    hazeK: 1.1,
    mul: [246, 247, 243],
    desat: 0.05,
    tint: { rgb: "255 255 250", alpha: 0 },
    shadow: { dx: -0.6, len: 1.2, alpha: 0.9 },
    glint: 0.6
  },
  noon: {
    sky: "255 255 250",
    skyAlpha: 0,
    hazeK: 1,
    mul: [255, 255, 255],
    desat: 0,
    tint: { rgb: "255 255 250", alpha: 0 },
    shadow: { dx: 0, len: 0.5, alpha: 1 },
    glint: 1
  },
  dusk: {
    sky: "170 148 160",
    skyAlpha: 0.22,
    hazeK: 1.2,
    mul: [246, 233, 232],
    desat: 0.1,
    tint: { rgb: "150 122 142", alpha: 0.05 },
    shadow: { dx: 1, len: 1.8, alpha: 1.1 },
    glint: 1.2
  },
  evening: {
    sky: "120 132 160",
    skyAlpha: 0.34,
    hazeK: 1.3,
    mul: [210, 218, 234],
    desat: 0.12,
    tint: { rgb: "90 104 136", alpha: 0.07 },
    shadow: { dx: 0.6, len: 1.2, alpha: 0.55 },
    glint: 0
  },
  night: {
    sky: "96 110 140",
    skyAlpha: 0.46,
    hazeK: 1.4,
    mul: [184, 194, 215],
    desat: 0.38,
    tint: { rgb: "48 66 102", alpha: 0.1 },
    shadow: { dx: 0, len: 0.6, alpha: 0.33 },
    glint: 0.5
  }
};

// 안개의 시간대 배율(GRAMMAR §3.1) — 새벽·아침 세게, 점심 약하게.
const FOG_BY_BAND: Record<DayBand, number> = { dawn: 1.6, morning: 1.2, noon: 0.5, dusk: 0.8, evening: 1.0, night: 1.2 };

const mixRgb = (a: string, b: string, t: number): string => {
  const pa = a.split(" ").map(Number);
  const pb = b.split(" ").map(Number);
  return pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(" ");
};
const scaleMul = (m: [number, number, number], k: [number, number, number]): [number, number, number] => [
  Math.round(m[0] * k[0]),
  Math.round(m[1] * k[1]),
  Math.round(m[2] * k[2])
];

/** (시간대, 날씨, 계절) → 조명. 순수 함수 — 같은 입력이면 같은 값(결정성). hazeRgb는 ""이면 계절 기본색. */
export function lightOf(band: DayBand, weather: Weather, season: SeasonKey): Light {
  const b = BAND[band];
  const L: Light = {
    sky: b.sky,
    skyAlpha: b.skyAlpha,
    hazeRgb: band === "noon" ? "" : b.sky,
    hazeK: b.hazeK,
    groundFog: 0,
    mul: [...b.mul] as [number, number, number],
    desat: b.desat,
    tint: { ...b.tint },
    shadow: { ...b.shadow },
    glint: b.glint,
    wind: 0.08
  };
  // 밤 눈밭은 알베도로 덜 어둡다(GRAMMAR §3.1: 밤 ΔL −16 대신 −10).
  if (season === "winter" && (band === "night" || band === "evening")) L.mul = scaleMul(L.mul, [1.08, 1.07, 1.05]);
  switch (weather) {
    case "cloud":
      // 흰빛 → 회색, 그림자 옅게(길이 그대로), 글린트 0, 대비 −20%(§3.2 흐림 행).
      L.sky = mixRgb(L.sky, "196 200 206", 0.7);
      L.skyAlpha = Math.max(L.skyAlpha, 0.26);
      L.mul = scaleMul(L.mul, [0.9, 0.905, 0.915]);
      L.desat += 0.12;
      L.shadow.alpha *= 0.4;
      L.glint = 0;
      L.hazeK *= 1.15;
      L.hazeRgb = L.hazeRgb ? mixRgb(L.hazeRgb, "200 204 210", 0.5) : "204 208 212";
      L.wind = 0.14;
      break;
    case "rain":
      // 회청 하늘(L −14), 젖은 지면(L −8, 어둡고 차게), 글린트 0, 원경 대비 −35%.
      L.sky = mixRgb(L.sky, "132 142 154", 0.75);
      L.skyAlpha = Math.max(L.skyAlpha, 0.38);
      L.mul = scaleMul(L.mul, [0.84, 0.86, 0.9]);
      L.desat += 0.08;
      L.shadow.alpha *= 0.3;
      L.glint = 0;
      L.hazeK *= 1.3;
      L.hazeRgb = L.hazeRgb ? mixRgb(L.hazeRgb, "150 160 172", 0.5) : "160 170 180";
      L.wind = 0.4;
      break;
    case "snow":
      // 회백 하늘(L −6), 지면은 눈이 밝히므로 조금만, 그림자 절반, 입자는 엔진 입자층.
      L.sky = mixRgb(L.sky, "198 204 212", 0.7);
      L.skyAlpha = Math.max(L.skyAlpha, 0.32);
      L.mul = scaleMul(L.mul, [0.94, 0.945, 0.96]);
      L.desat += 0.15;
      L.shadow.alpha *= 0.5;
      L.glint *= 0.3;
      L.hazeK *= 1.2;
      L.hazeRgb = L.hazeRgb ? mixRgb(L.hazeRgb, "208 214 222", 0.5) : "214 220 226";
      L.wind = 0.3;
      break;
    case "fog": {
      // **깊이 감쇠**(D-3): 층별 누적 안개(후경 .55 · 중경 .3 · 전경 .1) + 지면 안개 띠, 시간대 배율. 반사 0, 그림자 절반.
      const k = FOG_BY_BAND[band];
      L.groundFog = Math.min(1, 0.55 * k);
      L.hazeK *= 1 + 0.9 * k;
      L.sky = mixRgb(L.sky, "226 230 232", 0.55);
      L.skyAlpha = Math.max(L.skyAlpha, 0.22 + 0.1 * k);
      L.hazeRgb = L.hazeRgb ? mixRgb(L.hazeRgb, "226 230 232", 0.55) : "228 232 234";
      L.desat += 0.2;
      L.shadow.alpha *= 0.5;
      L.glint = 0;
      L.wind = 0.04;
      break;
    }
    case "wind":
      // 바람: 안개 걷힘(×.7) + 하늘도 맑아진다(오버레이 ×.8 — 탁한 공기가 쓸려 나간다), 글린트 조금 더, 입자·흔들림은 wind 1.
      L.hazeK *= 0.7;
      L.skyAlpha *= 0.8;
      L.glint *= 1.1;
      L.wind = 1;
      break;
    default:
      break;
  }
  L.desat = Math.min(0.7, L.desat);
  L.tint.alpha = Math.min(0.1, L.tint.alpha);
  return L;
}

/** rgb 문자열 보간 — 4단위로 양자화해 안개 그라데이션 캐시 키가 3초 전이에 ≤ 16개만 생기게 한다. 빈 문자열(계절 기본색)은 상대 쪽으로 스냅. */
function lerpRgb(a: string, b: string, t: number): string {
  if (!a || !b) return t >= 0.5 ? b : a;
  const pa = a.split(" ").map(Number);
  const pb = b.split(" ").map(Number);
  return pa.map((v, i) => Math.round((v + (pb[i] - v) * t) / 4) * 4).join(" ");
}

/** 두 조명 사이 보간(전이는 부드럽게 — GRAMMAR 원칙 4). t=1이면 b 그대로. 색도 수치로 보간한다 — 옛 "t ≥ .5에서 스위치"는
 *  전이 정중앙에서 하늘이 3~9 L "툭" 튀었다(QA 라운드 3 C#5 실측: 새벽→아침 1.76s 하늘 +9.0 L). */
export function lerpLight(a: Light, b: Light, t: number): Light {
  if (t >= 1) return b;
  const l = (x: number, y: number) => x + (y - x) * t;
  return {
    sky: lerpRgb(a.sky, b.sky, t),
    skyAlpha: l(a.skyAlpha, b.skyAlpha),
    hazeRgb: lerpRgb(a.hazeRgb, b.hazeRgb, t),
    hazeK: l(a.hazeK, b.hazeK),
    groundFog: l(a.groundFog, b.groundFog),
    mul: [Math.round(l(a.mul[0], b.mul[0])), Math.round(l(a.mul[1], b.mul[1])), Math.round(l(a.mul[2], b.mul[2]))],
    desat: l(a.desat, b.desat),
    tint: { rgb: lerpRgb(a.tint.rgb, b.tint.rgb, t), alpha: l(a.tint.alpha, b.tint.alpha) },
    shadow: { dx: l(a.shadow.dx, b.shadow.dx), len: l(a.shadow.len, b.shadow.len), alpha: l(a.shadow.alpha, b.shadow.alpha) },
    glint: l(a.glint, b.glint),
    wind: l(a.wind, b.wind)
  };
}

export const isNeutralMul = (m: [number, number, number]) => m[0] >= 255 && m[1] >= 255 && m[2] >= 255;

// 장면이 읽는 현재 조명(엔진이 프레임마다 set). 장면 코드에 Frame을 다 꿰지 않아도 발밑 그림자·바람이 같은 값을 본다.
let current: Light = NEUTRAL_LIGHT;
export const setCurrentLight = (l: Light) => {
  current = l;
};
export const currentLight = (): Light => current;
