// 세계 시간(2026-09-04, PLAN-20260904-003 Phase A) — 하루를 여섯 띠로 나눈다(소유자 결정 ①: 새벽·아침·점심·노을·저녁·밤).
// 띠는 KST 시각과 계절의 일출·일몰로 정한다(여름 새벽은 5시, 겨울은 7시 반). 장면은 띠로 스폰 풀(야행성·주행성)과 빛 톤을
// 고른다. 빛 톤은 오행 팔레트 규칙을 지킨다 — 노을도 주황이 아니라 회자색, 밤은 청회색(붉·주황·노랑 강조 금지).
// 시간의 진실은 KST(Non-negotiable 1) — 서버·클라이언트 어디서 계산해도 같은 띠.

import type { SeasonKey } from "@/components/shared/ambient/registry";

export type DayBand = "dawn" | "morning" | "noon" | "dusk" | "evening" | "night";
export const DAY_BANDS: readonly DayBand[] = ["dawn", "morning", "noon", "dusk", "evening", "night"];
export const BAND_LABEL: Record<DayBand, string> = { dawn: "새벽", morning: "아침", noon: "점심", dusk: "노을", evening: "저녁", night: "밤" };

// 계절별 대략의 일출·일몰(KST, 소수 시간). 서울 기준 계절 평균 — 정밀 천문 계산은 과하다(띠는 '느낌'이다).
const SUN: Record<SeasonKey, { rise: number; set: number }> = {
  spring: { rise: 6.3, set: 19.0 },
  summer: { rise: 5.3, set: 19.7 },
  autumn: { rise: 6.6, set: 18.1 },
  winter: { rise: 7.5, set: 17.5 }
};

/** 지금(또는 주어진 시각)의 KST 소수 시간(0~24). */
export function kstHour(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const h = get("hour") % 24;
  return h + get("minute") / 60;
}

/** 시각(KST 소수 시간)·계절 → 여섯 띠. 새벽 = 일출 −1.5h ~ +1h · 아침 = ~11시 · 점심 = 11시 ~ 일몰 −1.5h · 노을 = 일몰 ±(−1.5, +0.5)h ·
 *  저녁 = 일몰 +0.5 ~ +2.5h · 밤 = 그 밖. */
export function bandOf(hour: number, season: SeasonKey): DayBand {
  const { rise, set } = SUN[season];
  const h = ((hour % 24) + 24) % 24;
  if (h >= rise - 1.5 && h < rise + 1) return "dawn";
  if (h >= rise + 1 && h < 11) return "morning";
  if (h >= 11 && h < set - 1.5) return "noon";
  if (h >= set - 1.5 && h < set + 0.5) return "dusk";
  if (h >= set + 0.5 && h < set + 2.5) return "evening";
  return "night";
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

export type WorldTime = { hour: number; band: DayBand; night: boolean; tint: LightTint };

export function worldTime(season: SeasonKey, hour: number = kstHour()): WorldTime {
  const band = bandOf(hour, season);
  return { hour, band, night: band === "night" || band === "evening", tint: LIGHT[band] };
}
