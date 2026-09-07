// 세계 시간(2026-09-04, PLAN-20260904-003 Phase A · **2026-09-07 연속화**, PLAN-20260907-006) —
// 하루는 여섯 띠다(소유자 결정 ①: 새벽·아침·점심·노을·저녁·밤). 다만 띠는 이제 **칸이 아니라 거점**이고, 그 사이는
// 끊김 없이 이어진다. 거점의 시각을 정하는 것은 계절표가 아니라 **그 날의 실제 태양**(`sun.ts`, 황도 경사 → 적위·균시차):
// 겨울은 밤이 길고 해가 낮게 지나가며, 그 사실이 조명·그림자·해의 높이에 그대로 나온다.
//
// 위상은 **태양 고도**로 잰다(시각이 아니라). 낮은 그 날의 남중고도로 정규화하고(q = alt / maxAlt ∈ 0~1),
// 박명은 −18°(천문박명)를 바닥으로 정규화한다(q = alt / 18 ∈ −1~0). 거점의 q:
//   뜨는 쪽  밤 −1.0 → 새벽 −0.33(고도 −6°, 시민박명) → 아침 0.5 → 점심 1.0
//   지는 쪽  점심 1.0 → 노을 0.0(일몰) → 저녁 −0.5 → 밤 −1.0
// (새벽은 일출 조금 전, 노을은 일몰 그 자리 — 옛 표의 느낌 그대로다. 여름 19시 = 노을 88%, 겨울 5시 반 = 밤.)
// `band`는 두 거점 중 가까운 쪽의 이름이라 스폰 풀·도감·QA 시트·개발자 강제는 옛 의미 그대로 쓴다.
// 시간의 진실은 KST(Non-negotiable 1).

import type { SeasonKey } from "@/components/shared/ambient/registry";
import { sunDay, sunPos, type SunPos } from "./sun";

export type DayBand = "dawn" | "morning" | "noon" | "dusk" | "evening" | "night";
export const DAY_BANDS: readonly DayBand[] = ["dawn", "morning", "noon", "dusk", "evening", "night"];
export const BAND_LABEL: Record<DayBand, string> = { dawn: "새벽", morning: "아침", noon: "점심", dusk: "노을", evening: "저녁", night: "밤" };

/** 계절의 대표 날짜(날짜를 모르는 옛 호출용 — `bandOf(hour, season)`). */
const SEASON_DAY: Record<SeasonKey, [number, number]> = { spring: [4, 15], summer: [7, 15], autumn: [10, 15], winter: [1, 15] };
const seasonDate = (season: SeasonKey): [number, number, number] => {
  const [m, d] = SEASON_DAY[season];
  return [new Date().getUTCFullYear(), m, d];
};

/** 박명의 바닥(도, 천문박명) — 이보다 깊으면 완전한 밤. */
const TWILIGHT_FLOOR = 18;

/** 거점의 q(정규화 고도). 뜨는 쪽과 지는 쪽이 다르다 — 새벽은 일출 조금 전, 노을은 일몰 그 자리. */
const RISING: { band: DayBand; q: number }[] = [
  { band: "night", q: -1 },
  { band: "dawn", q: -0.33 },
  { band: "morning", q: 0.5 },
  { band: "noon", q: 1 }
];
const FALLING: { band: DayBand; q: number }[] = [
  { band: "noon", q: 1 },
  { band: "dusk", q: 0 },
  { band: "evening", q: -0.5 },
  { band: "night", q: -1 }
];

/** 지금(또는 주어진 시각)의 KST 소수 시간(0~24). */
export function kstHour(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const h = get("hour") % 24;
  return h + get("minute") / 60;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

export type BandPhase = {
  /** 가까운 거점의 이름 — 옛 `band`의 의미(스폰 풀·도감·시트·강제). */
  band: DayBand;
  /** 지금 서 있는 구간의 두 거점. 조명은 이 둘을 `mix`로 섞는다. */
  from: DayBand;
  to: DayBand;
  /** 0~1, 이징 적용. 0 = from 그대로, 1 = to 그대로. */
  mix: number;
  /** 정규화 고도(−1 = 깊은 밤, 0 = 지평선, 1 = 그 날의 남중). */
  q: number;
  /** 해가 올라가는 중인가(남중 전). */
  rising: boolean;
};

/** 태양 고도 → 정규화 고도 q. 낮은 그 날의 남중고도로, 박명은 −12°로 잰다. */
export function normAlt(alt: number, maxAlt: number): number {
  if (alt >= 0) return Math.min(1, alt / Math.max(1, maxAlt));
  return Math.max(-1, alt / TWILIGHT_FLOOR);
}

function phaseOf(q: number, rising: boolean): BandPhase {
  const line = rising ? RISING : FALLING;
  // 구간 찾기 — 뜨는 쪽은 q가 커지고, 지는 쪽은 작아진다.
  let i = 0;
  for (; i < line.length - 2; i++) {
    const next = line[i + 1].q;
    if (rising ? q < next : q > next) break;
  }
  const a = line[i];
  const b = line[i + 1];
  const span = b.q - a.q;
  const raw = span === 0 ? 1 : (q - a.q) / span;
  const mix = smooth(Math.max(0, Math.min(1, raw)));
  return { band: mix < 0.5 ? a.band : b.band, from: a.band, to: b.band, mix, q, rising };
}

/** 시각(KST 소수 시간) + 날짜 → 위상. 날짜가 그 날의 태양(일출·일몰·남중고도)을 정한다. */
export function bandPhase(hour: number, y: number, m: number, d: number): BandPhase {
  const h = ((hour % 24) + 24) % 24;
  const day = sunDay(y, m, d);
  const { alt } = sunPos(y, m, d, h);
  return phaseOf(normAlt(alt, day.maxAlt), h < day.noon);
}

/** 시각·계절 → 여섯 띠(옛 서명 — 날짜를 모르는 호출용. 계절의 대표 날짜로 태양을 센다). */
export function bandOf(hour: number, season: SeasonKey): DayBand {
  const [y, m, d] = seasonDate(season);
  return bandPhase(hour, y, m, d).band;
}

export type LightTint = { rgb: string; alpha: number };
/** 띠별 빛 톤(캔버스 전체에 한 번 덮는 옅은 색) — 낮은 없음. 노을은 회자색, 저녁·밤은 청회색(주황 금지). */
export const LIGHT: Record<DayBand, LightTint> = {
  dawn: { rgb: "118 128 158", alpha: 0.08 },
  morning: { rgb: "255 255 250", alpha: 0 },
  noon: { rgb: "255 255 250", alpha: 0 },
  dusk: { rgb: "150 122 142", alpha: 0.09 },
  evening: { rgb: "90 104 136", alpha: 0.14 },
  night: { rgb: "48 66 102", alpha: 0.24 }
};

export type WorldTime = {
  hour: number;
  band: DayBand;
  /** 조명이 섞는 두 거점과 그 비율(PLAN-20260907-006). */
  from: DayBand;
  to: DayBand;
  mix: number;
  night: boolean;
  tint: LightTint;
  /** 그 순간의 해(고도·방위, 도) — 하늘의 해 높이와 그림자 길이가 읽는다. 겨울이 낮다. */
  sun: SunPos;
  /** 그 날의 일출·일몰·남중고도(KST 소수 시간, 도). */
  rise: number;
  set: number;
  maxAlt: number;
};

const mixTint = (a: LightTint, b: LightTint, t: number): LightTint => {
  const p = a.rgb.split(" ").map(Number);
  const q = b.rgb.split(" ").map(Number);
  const l = (x: number, y: number) => Math.round(x + (y - x) * t);
  return { rgb: `${l(p[0], q[0])} ${l(p[1], q[1])} ${l(p[2], q[2])}`, alpha: a.alpha + (b.alpha - a.alpha) * t };
};

/** 계절·시각(+ 날짜) → 지금의 세계 시간. 날짜를 주면 그 날의 태양으로, 없으면 계절의 대표 날짜로 센다. */
export function worldTime(season: SeasonKey, hour: number = kstHour(), date?: { y: number; m: number; d: number }): WorldTime {
  const [dy, dm, dd] = date ? [date.y, date.m, date.d] : seasonDate(season);
  const h = ((hour % 24) + 24) % 24;
  const day = sunDay(dy, dm, dd);
  const sun = sunPos(dy, dm, dd, h);
  const ph = phaseOf(normAlt(sun.alt, day.maxAlt), h < day.noon);
  return {
    hour: h,
    band: ph.band,
    from: ph.from,
    to: ph.to,
    mix: ph.mix,
    night: ph.band === "night" || ph.band === "evening",
    tint: mixTint(LIGHT[ph.from], LIGHT[ph.to], ph.mix),
    sun,
    rise: day.rise,
    set: day.set,
    maxAlt: day.maxAlt
  };
}

/** 띠를 직접 강제(개발자 시간 여행) — 그 띠의 대표 시각을 **그 날의 태양에서** 찾고, 위상은 거점에 정확히 세운다. */
export function worldTimeOfBand(season: SeasonKey, band: DayBand, date?: { y: number; m: number; d: number }): WorldTime {
  const [dy, dm, dd] = date ? [date.y, date.m, date.d] : seasonDate(season);
  const day = sunDay(dy, dm, dd);
  const hour =
    band === "dawn"
      ? day.rise - 0.35
      : band === "morning"
        ? day.rise + (day.noon - day.rise) * 0.6
        : band === "noon"
          ? day.noon
          : band === "dusk"
            ? day.set
            : band === "evening"
              ? day.duskCivil + 0.4
              : (day.noon + 12) % 24;
  return {
    hour,
    band,
    from: band,
    to: band,
    mix: 0,
    night: band === "night" || band === "evening",
    tint: LIGHT[band],
    sun: sunPos(dy, dm, dd, hour),
    rise: day.rise,
    set: day.set,
    maxAlt: day.maxAlt
  };
}
