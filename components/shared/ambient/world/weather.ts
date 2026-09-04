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

export type DayWeather = { now: Weather; prev: Weather; segment: 0 | 1 };

/** (slug, y, m, d, 시각) → 이 마디의 날씨와 직전 마디의 날씨. 오전 마디 = 0~13시, 오후 마디 = 13~24시. */
export function weatherAt(slug: string, y: number, m: number, d: number, hour: number): DayWeather {
  const t = monthTable(m);
  const r0 = hashSeed(slug, "weather", y, m, d, 0)();
  const r1 = hashSeed(slug, "weather", y, m, d, 1)();
  const am = pick(t, r0);
  // 오후는 60%가 오전을 잇는다(하루 안에 날씨가 너무 자주 바뀌지 않게).
  const pm = r1 < 0.6 ? am : pick(t, (r1 - 0.6) / 0.4);
  if (hour < 13) {
    // 전날 오후
    const yd = new Date(Date.UTC(y, m - 1, d - 1));
    const py = yd.getUTCFullYear();
    const pm_ = yd.getUTCMonth() + 1;
    const pd = yd.getUTCDate();
    const pr0 = hashSeed(slug, "weather", py, pm_, pd, 0)();
    const pr1 = hashSeed(slug, "weather", py, pm_, pd, 1)();
    const pt = monthTable(pm_);
    const pam = pick(pt, pr0);
    const ppm = pr1 < 0.6 ? pam : pick(pt, (pr1 - 0.6) / 0.4);
    return { now: am, prev: ppm, segment: 0 };
  }
  return { now: pm, prev: am, segment: 1 };
}
