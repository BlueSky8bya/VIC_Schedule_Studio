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
  /** 그림자 — dx: 해 반대쪽(−1 = 왼쪽/서 … +1 = 오른쪽/동), len: 몸 높이 대비 길이 배(점심 .5), alpha: 농도 배(점심 1). */
  shadow: { dx: number; len: number; alpha: number };
  /** 수면 글린트·반사 배(점심 1, 흐림·비·안개 0). */
  glint: number;
  /** 바람 0~1 — 입자층·나무 흔들림·풀 진행파가 읽는다(맑음 .08). */
  wind: number;
  /** 수면 위 빛의 길(라운드 4, AMB-T1-03 — GRAMMAR §2.1 "노을 = 길게 늘어진 반사 띠 · 밤 = 달빛 띠 1"): k = 세기 0~1(점심·흐림·비·안개 0),
   *  rgb = 띠 색(노을 회장미, 밤 달빛 청백, 새벽 청회), x = 화면 폭 대비 가로 자리(해·달의 방위 = 그림자 반대쪽),
   *  skyK = 하늘의 좌우 방향성(해·달 쪽 밝고 반대쪽 어둡다, 0 = 좌우 동일 — 라운드 4 A#2 "노을 하늘이 좌우 완전 동일 = 방향 0"). */
  reflect: { k: number; rgb: string; x: number; skyK: number };
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
  wind: 0.08,
  reflect: { k: 0, rgb: "255 250 240", x: 0.5, skyK: 0 }
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
  reflect: { k: number; rgb: string; skyK: number };
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
    shadow: { dx: -1, len: 1.6, alpha: 0.8 }, // .55 → .80(2026-09-06 라운드 8, C: 새벽 그림자 코어 하강 1.98L < 기준 4L)
    glint: 0,
    reflect: { k: 0.26, rgb: "210 218 232", skyK: 0.16 }
  },
  morning: {
    sky: "250 250 245",
    skyAlpha: 0.16,
    // 아침↔점심이 세 라운드 연속 "채널 하나"였다(검토 C: 지면 ΔL 0.63~1.41, 목표 2). mul을 −2L에 맞추고,
    // 두 번째 채널을 **아침 안개 잔재**(hazeK 1.1 → 1.28)와 수면 글린트로 세운다 — 그림자는 점심이 짧아 줄기에 가려 신호가 안 난다.
    hazeK: 1.28,
    mul: [241, 242, 238],
    desat: 0.05,
    tint: { rgb: "255 255 250", alpha: 0 },
    shadow: { dx: -0.6, len: 1.3, alpha: 1.15 }, // 아침 stretch 하한(검토 C) · α .95 → 1.15(라운드 10 A: 아침 그림자가 2배 확대에서도 안 읽힘)
    glint: 0.6,
    reflect: { k: 0, rgb: "255 250 240", skyK: 0 }
  },
  noon: {
    sky: "255 255 250",
    skyAlpha: 0,
    hazeK: 1,
    mul: [255, 255, 255],
    desat: 0,
    tint: { rgb: "255 255 250", alpha: 0 },
    shadow: { dx: 0, len: 0.5, alpha: 1 },
    glint: 1,
    reflect: { k: 0, rgb: "255 250 240", skyK: 0 }
  },
  dusk: {
    sky: "170 148 160",
    skyAlpha: 0.22,
    hazeK: 1.2,
    mul: [246, 233, 232],
    desat: 0.1,
    tint: { rgb: "150 122 142", alpha: 0.05 },
    shadow: { dx: 1, len: 1.8, alpha: 1.1 },
    glint: 1.2,
    reflect: { k: 0.62, rgb: "240 220 210", skyK: 0.36 }
  },
  evening: {
    sky: "120 132 160",
    skyAlpha: 0.34,
    hazeK: 1.3,
    // 라운드 10(검토 A #1): 파란 multiply가 따뜻한 색(가을 갈색)의 크로마를 상쇄해 저녁 채도가 규칙 ×.8이 아니라 ×.39~.63으로
    // 빠졌다. 색온도는 `tint`가 맡고 mul은 중성에 가깝게(휘도는 그대로 217) — 채도 채널을 desat 하나로 되돌린다.
    mul: [213, 216, 224],
    desat: 0.04, // .08 → .04(라운드 10 실측: 가을 저녁 크로마 ×.46, 규칙 ×.8 — 남은 탈채도는 tint·안개가 이미 낸다)
    // α .10 → .04(2026-09-06 라운드 14, 검토 A #4 · C 라운드 13 부록 F ①): tint는 source-over 색 덮기라 **무채색 바탕에 크로마를 만든다**
    // — 갯벌 뻘 C* 점심 2.0 → 저녁 5.6(×2.76) → 밤 5.8(×2.82), 회색 뻘이 밤에 더 파래졌다. 색온도는 mul이 이미 옮기고 있으니
    // tint는 얇은 마무리만 맡는다. 밤 하한(민물 −20.1 · 모래 −16.9, 규칙 −16)도 같은 항이 눌러 온 것.
    tint: { rgb: "90 104 136", alpha: 0.04 },
    shadow: { dx: 0.6, len: 1.2, alpha: 0.8 }, // 저녁도 같은 이유
    glint: 0,
    reflect: { k: 0.22, rgb: "184 196 218", skyK: 0.14 }
  },
  night: {
    sky: "96 110 140",
    skyAlpha: 0.46,
    hazeK: 1.4,
    // 184 → 194(2026-09-06 라운드 8, 검토 C): 밤은 **곱셈**이라 ΔL이 바탕 L에 비례해 밝은 바이옴이 먼저
    // 규칙을 깨졌다(민물 봄 −18.74 · 초원 여름 −16.3 · 언덕 가을 −16.06, 하한 −16). 밝은 지면이 −16 안에 들게 올린다
    // — 어두운 바이옴은 −10.5 → −9.9로 조금 올라오지만, 그쪽은 원래 여유가 있었다.
    // 라운드 10: 같은 이유로 mul을 중성 쪽으로(휘도 202 유지), desat .38 → .28(규칙 ×.62 = 크로마 잔존 .5~.7).
    mul: [198, 203, 214],
    desat: 0.16, // .28 → .16(가을 밤 크로마 ×.26, 규칙 ×.62)
    tint: { rgb: "48 66 102", alpha: 0.04 }, // 저녁과 같은 이유(라운드 14, A #4) — 밤 하한과 무채색 크로마 주입을 함께 푼다
    shadow: { dx: 0, len: 0.6, alpha: 0.33 },
    glint: 0.5,
    reflect: { k: 0.58, rgb: "222 232 246", skyK: 0.1 }
  }
};

// 안개의 시간대 배율(GRAMMAR §3.1) — 새벽·아침 세게, 점심 약하게.
const FOG_BY_BAND: Record<DayBand, number> = { dawn: 1.6, morning: 1.2, noon: 0.5, dusk: 0.8, evening: 1.0, night: 1.2 };

const mixRgb = (a: string, b: string, t: number): string => {
  const pa = a.split(" ").map(Number);
  const pb = b.split(" ").map(Number);
  return pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(" ");
};
/** rgb 문자열의 상대 휘도(0~255). */
const lumaOf = (rgb: string): number => {
  const c = rgb.split(" ").map(Number);
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
};

/** 색조(hue)는 그대로, **밝기만 목표에 맞춘** 회색을 만든다(2026-09-06 라운드 9, 검토 C).
 *  날씨 오버레이가 상수 밝은 회색으로 섞이면 **띠를 모른다** — 밤 흐림 하늘 판이 −17.5L인데 화면에서 −0.1L로
 *  되돌아왔다(어두운 밤 하늘 위에 L 170짜리 회색을 α .46으로 얹으니까). 목표를 "그 띠 하늘 ± dL"로 잡으면
 *  같은 오버레이가 어느 띠에서나 같은 방향으로 작동한다. */
const tintTo = (base: string, hue: string, dL: number): string => {
  const target = Math.max(6, lumaOf(base) + dL);
  const c = hue.split(" ").map(Number);
  const k = target / Math.max(1, lumaOf(hue));
  return c.map((v) => Math.round(Math.max(0, Math.min(255, v * k)))).join(" ");
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
    wind: 0.08,
    // 빛의 길의 가로 자리 = 해·달의 방위 — 그림자가 뻗는 쪽의 반대(새벽 해 동쪽 → 띠 오른쪽, 노을 해 서쪽 → 왼쪽). 밤 달은 살짝 오른쪽.
    reflect: { ...b.reflect, x: 0.5 - b.shadow.dx * 0.22 + (band === "night" ? 0.08 : 0) }
  };
  // 밤 눈밭은 알베도로 덜 어둡다(GRAMMAR §3.1: 밤 ΔL −16 대신 −10).
  if (season === "winter" && (band === "night" || band === "evening")) L.mul = scaleMul(L.mul, [1.08, 1.07, 1.05]);
  // 새벽·맑음의 원거리 습기(GRAMMAR §2.2 "원거리 습기 허용", 라운드 4 AMB-T1-03) — 안개 날씨가 아니어도 발치 띠가 옅게 깔려
  // 새벽↔저녁이 그림자 방향 말고도 갈린다. .2 = 안개 날씨(.55×1.6)의 1/4.
  if (band === "dawn" && weather === "clear") L.groundFog = 0.2;
  switch (weather) {
    case "cloud":
      // 흰빛 → 회색, 그림자 옅게(길이 그대로), 글린트 0, 대비 −20%(§3.2 흐림 행).
      L.sky = mixRgb(L.sky, tintTo(L.sky, "196 200 206", -26), 0.7);
      L.skyAlpha = Math.max(L.skyAlpha, 0.26);
      L.mul = scaleMul(L.mul, [0.9, 0.905, 0.915]);
      L.desat += 0.12;
      L.shadow.alpha *= 0.4;
      L.glint = 0;
      L.reflect.k = 0;
      L.reflect.skyK = 0;
      L.hazeK *= 1.15;
      L.hazeRgb = L.hazeRgb ? mixRgb(L.hazeRgb, "200 204 210", 0.5) : "204 208 212";
      L.wind = 0.14;
      break;
    case "rain":
      // 회청 하늘(L −14), 젖은 지면(L −8, 어둡고 차게), 글린트 0, 원경 대비 −35%.
      L.sky = mixRgb(L.sky, tintTo(L.sky, "132 142 154", -40), 0.75);
      L.skyAlpha = Math.max(L.skyAlpha, 0.38);
      L.mul = scaleMul(L.mul, [0.84, 0.86, 0.9]);
      // 비의 지면은 **젖어서 진하다** — 탈채도는 규칙의 반대 방향이다(2026-09-06 라운드 9, 검토 C:
      // Δ채도 −0.05~−0.07, 규칙 +10%). 원경 대비 −35%는 아래 `hazeK`가 이미 맡는다.
      // (젖음으로 채도를 **올리는** 것은 웅덩이 반사와 함께 별건으로 남긴다 — 백로그.)
      L.shadow.alpha *= 0.3;
      L.glint = 0;
      L.reflect.k = 0;
      L.reflect.skyK = 0;
      L.hazeK *= 1.3;
      L.hazeRgb = L.hazeRgb ? mixRgb(L.hazeRgb, "150 160 172", 0.5) : "160 170 180";
      L.wind = 0.4;
      break;
    case "snow":
      // 회백 하늘(L −6), 지면은 눈이 밝히므로 조금만, 그림자 절반, 입자는 엔진 입자층.
      L.sky = mixRgb(L.sky, tintTo(L.sky, "198 204 212", -20), 0.7);
      L.skyAlpha = Math.max(L.skyAlpha, 0.32);
      L.mul = scaleMul(L.mul, [0.94, 0.945, 0.96]);
      L.desat += 0.15;
      L.shadow.alpha *= 0.5;
      L.glint *= 0.3;
      L.reflect.k *= 0.3;
      L.reflect.skyK *= 0.3;
      L.hazeK *= 1.2;
      L.hazeRgb = L.hazeRgb ? mixRgb(L.hazeRgb, "208 214 222", 0.5) : "214 220 226";
      L.wind = 0.3;
      break;
    case "fog": {
      // **깊이 감쇠**(D-3): 층별 누적 안개(후경 .55 · 중경 .3 · 전경 .1) + 지면 안개 띠, 시간대 배율. 반사 0, 그림자 절반.
      const k = FOG_BY_BAND[band];
      L.groundFog = Math.min(1, 0.55 * k);
      L.hazeK *= 1 + 0.9 * k;
      L.sky = mixRgb(L.sky, tintTo(L.sky, "226 230 232", 10), 0.55); // 안개는 규칙상 +4L — 그래도 **그 띠 기준**이다
      // 밝은 띠는 오버레이를 얇게 — 한 색으로 하늘 전체를 덮으면 세로 결이 눌린다(라운드 9 실측:
      // 낮 안개 하늘 세로 ΔL이 6.5 → 4.0으로 떨어졌다). 어두운 띠는 판 자체의 폭이 커서 영향이 적다.
      L.skyAlpha = Math.max(L.skyAlpha, (band === "noon" || band === "morning" ? 0.1 : 0.22) + 0.1 * k);
      L.hazeRgb = L.hazeRgb ? mixRgb(L.hazeRgb, "226 230 232", 0.55) : "228 232 234";
      // 균일 탈채도 .2 → .06(2026-09-06 라운드 11, 검토 A·C): 전 화면 saturation 블렌드가 안개를 "필터"로 읽히게 한 주범 —
      // 근경이 원경보다 더 탈채도됐다(s12 −5.2 vs −0.8). 탈채도는 밀도장(`world/fog.ts`)의 안개색 혼합이 깊이별로 낸다.
      L.desat += 0.06;
      L.shadow.alpha *= 0.5;
      L.glint = 0;
      L.reflect.k = 0;
      L.reflect.skyK = 0;
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
    wind: l(a.wind, b.wind),
    reflect: { k: l(a.reflect.k, b.reflect.k), rgb: lerpRgb(a.reflect.rgb, b.reflect.rgb, t), x: l(a.reflect.x, b.reflect.x), skyK: l(a.reflect.skyK, b.reflect.skyK) }
  };
}

/** 그림자 채널의 양자화 키(라운드 4, AMB-T1-03) — 바탕에 구운 소품 그림자는 조명이 바뀌면 **한 번** 다시 굽는다. 3초 전이 동안
 *  프레임마다 굽지 않도록 dx ¼·len ¼·alpha ⅛ 단위로 묶고, 장면은 `f.lightStable`(전이 끝)일 때만 키를 비교한다. */
export const shadowKey = (L: Light): string =>
  // 2026-09-06 라운드 9: 산 층 색이 **굽는 시점의 조명**(곱셈 배율·하늘 명도)에서 역산되므로 키에 함께 넣는다.
  // 안 넣으면 그림자 채널이 같은 날씨 전환(맑음 ↔ 흐림)에서 층 색이 옛 띠 값으로 굳는다.
  `${Math.round(L.shadow.dx * 4)}|${Math.round(L.shadow.len * 4)}|${Math.round(L.shadow.alpha * 8)}|${Math.round(
    (L.mul[0] * 0.2126 + L.mul[1] * 0.7152 + L.mul[2] * 0.0722) / 8
  )}|${L.sky}`;

export const isNeutralMul = (m: [number, number, number]) => m[0] >= 255 && m[1] >= 255 && m[2] >= 255;

// 장면이 읽는 현재 조명(엔진이 프레임마다 set). 장면 코드에 Frame을 다 꿰지 않아도 발밑 그림자·바람이 같은 값을 본다.
let current: Light = NEUTRAL_LIGHT;
export const setCurrentLight = (l: Light) => {
  current = l;
};
export const currentLight = (): Light => current;
