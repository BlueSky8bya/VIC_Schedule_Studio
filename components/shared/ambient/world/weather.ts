// 세계 날씨(2026-09-04, Phase A) — 실제 날씨 API 대신 **날짜 시드 난수**(소유자 결정 ⑤: "실제 날씨는 말고 랜덤으로").
// 같은 달력(slug)·같은 날이면 누구에게나 같은 날씨고 리로드해도 안 바뀐다 — '랜덤'이되 세계는 하나다. 하루는 오전·오후 두
// 마디로 굴리고(비가 그친 뒤 달팽이·지렁이가 나오는 창을 만들기 위해 '직전 마디' 날씨도 준다), 확률표는 계절을 따른다
// (7월 장마 비 40%, 겨울 눈 25% …). 장면은 f.weather로 비 파문·눈 세기·돌풍 빈도·비 뒤 생물을 고른다.

import type { SeasonKey } from "@/components/shared/ambient/registry";
import { hashSeed } from "./seed";

export type Weather = "clear" | "cloud" | "rain" | "snow" | "fog" | "wind";
export const WEATHER_LABEL: Record<Weather, string> = { clear: "맑음", cloud: "흐림", rain: "비", snow: "눈", fog: "안개", wind: "바람" };

type Table = [Weather, number][];
// 계절·월별 확률표(합 1). 7월은 장마라 비가 잦고, 겨울 눈은 12~2월, 11월엔 안개.
function table(season: SeasonKey, month: number): Table {
  if (season === "spring") return [["clear", 0.45], ["cloud", 0.25], ["rain", 0.18], ["fog", 0.07], ["wind", 0.05]];
  if (season === "summer") return month === 7 ? [["clear", 0.3], ["cloud", 0.2], ["rain", 0.42], ["wind", 0.08]] : [["clear", 0.45], ["cloud", 0.2], ["rain", 0.25], ["wind", 0.1]];
  if (season === "autumn") return month === 11 ? [["clear", 0.42], ["cloud", 0.22], ["rain", 0.1], ["fog", 0.18], ["wind", 0.08]] : [["clear", 0.52], ["cloud", 0.2], ["rain", 0.12], ["fog", 0.08], ["wind", 0.08]];
  return [["clear", 0.4], ["cloud", 0.25], ["snow", 0.25], ["fog", 0.05], ["wind", 0.05]];
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
export function weatherAt(slug: string, season: SeasonKey, y: number, m: number, d: number, hour: number): DayWeather {
  const t = table(season, m);
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
    const pt = table(season, pm_);
    const pam = pick(pt, pr0);
    const ppm = pr1 < 0.6 ? pam : pick(pt, (pr1 - 0.6) / 0.4);
    return { now: am, prev: ppm, segment: 0 };
  }
  return { now: pm, prev: am, segment: 1 };
}
