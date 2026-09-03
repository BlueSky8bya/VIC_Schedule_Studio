// 앰비언트 배경 레지스트리(2026-09-04, ADR-0017) — "오늘(KST)이 어떤 배경인가"를 정하는 유일한 곳.
//
// 개념: **물결(.gs-tide)은 상수, 계절은 강세.** 소유자 사주의 용신이 수(水)라 얕은 물결은 사철 깔리고,
// 계절 레이어는 그 물 위에 얹히는 몇 가지 소품이다(가을 = 물 위에 뜬 낙엽, 겨울 = 물가에 내리는 눈,
// 봄 = 물가의 초목 그림자·이슬, 여름 = 물결 그대로). 계절 구분은 양력 달이 아니라 **절기**(사주의 월 구분과
// 같다): 입춘 2/4 · 입하 5/5 · 입추 8/7 · 입동 11/7(해마다 ±1일 — 배경엔 무의미해 고정값).
// 오행 보정(docs/ux/seasonal-ambient-plan.md §3): 봄은 햇빛(火) 대신 초목(木)·이슬(水), 가을은 붉·주황·노랑
// 낙엽(火·조토 증폭) 대신 채도 낮춘 갈색·와인 잎 + 은빛 서리(金), 겨울은 눈(水의 결정 = 흰 金).
//
// 표시 게이트는 CSS(app/ambient.css): 생동감 있는 동작 ON ∧ data-gfx≠lite ∧ ≥641px ∧ **계절 배경 스위치 ON**
// (`html:not([data-ambient="off"])`, lib/ui/motion.ts). 스위치 OFF면 물결만 남는다.
// 특정일(성탄·할로윈·24절기)은 `SPECIAL_DAYS`에 추가한다 — 계절보다 우선(3단계, 아직 비어 있음).

export type SeasonKey = "spring" | "summer" | "autumn" | "winter";
export const SEASON_KEYS: readonly SeasonKey[] = ["spring", "summer", "autumn", "winter"];
export function isSeasonKey(value: string | null | undefined): value is SeasonKey {
  return value !== null && value !== undefined && (SEASON_KEYS as readonly string[]).includes(value);
}

export type KstDate = { y: number; m: number; d: number };

// 오늘(KST) — 서버(UTC)·클라이언트(어느 시간대든) 모두 같은 답. Non-negotiable 1(시간은 항상 KST).
export function kstToday(now: Date = new Date()): KstDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return { y: get("year"), m: get("month"), d: get("day") };
}

// 절기 기준 계절. 경계일 자체는 새 계절에 속한다(입추 당일 = 가을).
export function seasonOf({ m, d }: KstDate): SeasonKey {
  const md = m * 100 + d;
  if (md >= 204 && md < 505) return "spring";
  if (md >= 505 && md < 807) return "summer";
  if (md >= 807 && md < 1107) return "autumn";
  return "winter";
}

export type SpecialDayKey = "christmas" | "halloween";
export type SpecialDay = {
  key: SpecialDayKey;
  label: string;
  // 그 날인가(KST). 기간(예: 12/24~25)도 여기서 판단.
  match: (date: KstDate) => boolean;
};
// 3단계에서 채운다(성탄: 눈 + 표면 밖 여백의 트리·산타·루돌프 숨김 요소, 할로윈: 밝은 바탕 위 보랏빛 안개 —
// 붉·주황 증폭 금지). 지금은 비어 있어 계절만 판정한다.
export const SPECIAL_DAYS: readonly SpecialDay[] = [];

export type AmbientPick = { season: SeasonKey; day: SpecialDayKey | null };

export function pickAmbient(date: KstDate = kstToday(), force?: SeasonKey | null): AmbientPick {
  const season = force ?? seasonOf(date);
  const day = force ? null : (SPECIAL_DAYS.find((s) => s.match(date))?.key ?? null);
  return { season, day };
}
