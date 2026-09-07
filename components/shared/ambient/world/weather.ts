// 세계 날씨(2026-09-04, Phase A · 2026-09-05 월별 실측표로 교체) — 실제 기상 API 대신 **날짜 시드 난수**
// (소유자 결정 ⑤: "실제 날씨는 말고 랜덤으로"). 같은 달력(slug)·같은 날이면 누구에게나 같은 날씨고 리로드해도
// 안 바뀐다 — '랜덤'이되 세계는 하나다. 하루는 오전·오후 두 마디로 굴리고(비가 그친 뒤 달팽이·지렁이가 나오는
// 창을 만들기 위해 '직전 마디' 날씨도 준다). 장면은 f.weather로 비 파문·눈 세기·돌풍 빈도·비 뒤 생물을 고른다.
//
// ── 확률표의 근거(2026-09-05 소유자: "실제 연구자료 근거해서 월별로") ────────────────────────────────
// 기상청 평년값(1991~2020, 서울)의 월별 일수를 그 달의 날수로 나눈 **하루 발생 확률**이다.
//   · 강수일수(≥0.1mm): 1월 6.4 · 2월 5.9 · 3월 7.5 · 4월 8.4 · 5월 8.6 · 6월 9.5 · 7월 16.1 · 8월 14.3 ·
//     9월 8.3 · 10월 6.3 · 11월 8.2 · 12월 8.1
//   · 눈일수(신적설 ≥0.1cm): 12월 6.6 · 1월 7.7 · 2월 5.2 · 3월 1.6 · 11월 1.3 — 4~10월은 0
//   · 맑은날(운량 0~2) : 흐린날(운량 8~10) 비로 나머지를 맑음·흐림에 나눈다(7월이 가장 흐리고 10월이 가장 맑다).
//   · 안개는 가을·초겨울 아침에 잦고 한여름엔 드물다. 바람은 봄(꽃샘·황사)과 초겨울(북서풍)에 올린다.
// 겨울의 강수는 대부분 눈이다(12·1·2월은 눈 8할, 3·11월은 2할 이하) — 그래서 1월 비는 3%뿐이다.
// **여름(6~9월) 눈은 0%**, 4·5·10월도 0%다. 표 자체가 계절 규칙이므로 별도 검사가 필요 없다.
//
// 실제와 극적인 연출 사이: 이 표는 **평년값 그대로**다. 더 극적으로(예: 1월 눈 50%) 원하면 DRAMATIZE만 올린다 —
// 강수(비·눈)에 곱하고 나머지를 맑음·흐림에서 비례로 덜어낸다. 1 = 실제.

import { hashSeed } from "./seed";

export type Weather = "clear" | "cloud" | "rain" | "snow" | "fog" | "wind";
export const WEATHER_LABEL: Record<Weather, string> = { clear: "맑음", cloud: "흐림", rain: "비", snow: "눈", fog: "안개", wind: "바람" };

type Table = [Weather, number][];

/** 강수(비·눈)를 실제 평년값의 몇 배로 볼 것인가. 1 = 실제. 올리면 맑음·흐림에서 비례로 덜어낸다. */
export const DRAMATIZE = 1;

// 월별 하루 확률(합 1). [맑음, 흐림, 비, 눈, 안개, 바람]
const MONTH: Record<number, [number, number, number, number, number, number]> = {
  1: [0.39, 0.3, 0.03, 0.18, 0.05, 0.05],
  2: [0.34, 0.34, 0.04, 0.17, 0.05, 0.06],
  3: [0.27, 0.35, 0.19, 0.05, 0.05, 0.09],
  4: [0.25, 0.34, 0.28, 0, 0.04, 0.09],
  5: [0.26, 0.36, 0.28, 0, 0.04, 0.06],
  6: [0.17, 0.44, 0.32, 0, 0.03, 0.04],
  7: [0.05, 0.38, 0.52, 0, 0.02, 0.03],
  8: [0.11, 0.37, 0.46, 0, 0.02, 0.04],
  9: [0.29, 0.32, 0.28, 0, 0.06, 0.05],
  10: [0.44, 0.24, 0.2, 0, 0.08, 0.04],
  11: [0.32, 0.29, 0.23, 0.04, 0.07, 0.05],
  12: [0.35, 0.29, 0.05, 0.21, 0.05, 0.05]
};

/** 그 달의 확률표. DRAMATIZE > 1이면 강수를 키우고 맑음·흐림에서 비례로 덜어낸다(합은 늘 1). */
export function monthTable(month: number): Table {
  const [clear0, cloud0, rain0, snow0, fog, wind] = MONTH[Math.min(12, Math.max(1, Math.round(month)))];
  let rain = rain0 * DRAMATIZE;
  let snow = snow0 * DRAMATIZE;
  const dry = clear0 + cloud0;
  const room = Math.max(0, 1 - fog - wind);
  if (rain + snow > room) {
    const k = room / (rain + snow);
    rain *= k;
    snow *= k;
  }
  const rest = Math.max(0, room - rain - snow);
  const clear = dry > 0 ? (rest * clear0) / dry : rest / 2;
  const cloud = dry > 0 ? (rest * cloud0) / dry : rest / 2;
  return [
    ["clear", clear],
    ["cloud", cloud],
    ["rain", rain],
    ["snow", snow],
    ["fog", fog],
    ["wind", wind]
  ];
}

/** 그 달에 **실제로 생길 수 있는** 날씨(확률 > 0). 개발자 강제 목록이 계절과 어긋나지 않게 여기서 만든다 —
 *  여름에 눈을 고르면 만들지도 않은 "눈 덮인 여름 바이옴"을 보게 된다(2026-09-05 소유자). */
export function weatherOptionsForMonth(month: number): Weather[] {
  return monthTable(month)
    .filter(([, p]) => p > 0.001)
    .map(([w]) => w);
}

function pick(t: Table, r: number): Weather {
  let acc = 0;
  for (const [w, p] of t) {
    acc += p;
    if (r < acc) return w;
  }
  return t[t.length - 1][0];
}

export type DayWeather = {
  now: Weather;
  /** 직전 마디의 날씨(비 그친 뒤 달팽이·지렁이 같은 창을 만들기 위해). */
  prev: Weather;
  /** 0·1·2 — 하루 세 마디 중 어디인가. */
  segment: 0 | 1 | 2;
  /** 이 마디가 끝나는 시각(KST 소수 시간, 마지막 마디는 24). */
  until: number;
};

/** 마디 최소 길이(시간) — 경계가 랜덤이어도 날씨가 연달아 툭툭 바뀌지 않게 하는 하한(2026-09-07 소유자). */
export const SEGMENT_MIN_H = 4;

/** 그 날의 마디 경계(KST 소수 시간) — 날짜 시드로 랜덤이되 세 마디 모두 ≥ SEGMENT_MIN_H.
 *  b1 ∈ [6.5, 11], b2 ∈ [max(b1+4, 13), 20]. 마지막 마디는 24 − 20 = 4시간이 하한이다. */
export function segmentBounds(slug: string, y: number, m: number, d: number): [number, number] {
  const rb = hashSeed(slug, "weather-bounds", y, m, d, 0);
  const b1 = 6.5 + rb() * 4.5;
  const lo = Math.max(b1 + SEGMENT_MIN_H, 13);
  const b2 = lo + rb() * Math.max(0, 20 - lo);
  return [b1, b2];
}

/** 그 날 세 마디의 날씨(앞 마디를 55% 잇는다 — 하루가 색종이처럼 튀지 않게). */
function daySegments(slug: string, y: number, m: number, d: number): [Weather, Weather, Weather] {
  const t = monthTable(m);
  const r = hashSeed(slug, "weather", y, m, d, 0);
  const w0 = pick(t, r());
  const c1 = r();
  const w1 = c1 < 0.55 ? w0 : pick(t, (c1 - 0.55) / 0.45);
  const c2 = r();
  const w2 = c2 < 0.55 ? w1 : pick(t, (c2 - 0.55) / 0.45);
  return [w0, w1, w2];
}

/** (slug, y, m, d, 시각) → 이 마디의 날씨와 직전 마디의 날씨. 하루는 **세 마디**(경계는 날짜 시드 랜덤, 2026-09-07). */
export function weatherAt(slug: string, y: number, m: number, d: number, hour: number): DayWeather {
  const [b1, b2] = segmentBounds(slug, y, m, d);
  const segs = daySegments(slug, y, m, d);
  const h = ((hour % 24) + 24) % 24;
  const seg: 0 | 1 | 2 = h < b1 ? 0 : h < b2 ? 1 : 2;
  const until = seg === 0 ? b1 : seg === 1 ? b2 : 24;
  if (seg > 0) return { now: segs[seg], prev: segs[seg - 1], segment: seg, until };
  // 첫 마디의 직전은 전날 마지막 마디다.
  const yd = new Date(Date.UTC(y, m - 1, d - 1));
  const prev = daySegments(slug, yd.getUTCFullYear(), yd.getUTCMonth() + 1, yd.getUTCDate())[2];
  return { now: segs[0], prev, segment: 0, until };
}
