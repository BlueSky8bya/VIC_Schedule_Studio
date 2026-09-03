// 앰비언트 배경 레지스트리(2026-09-04, ADR-0017) — "이 달력 달이 어떤 배경인가"를 정하는 유일한 곳.
//
// 개념(2026-09-04 사용자 재정의): **계절은 보고 있는 달력의 달**이 정한다(오늘 날짜가 아니라 — 12월 달력을
// 넘기면 바로 겨울). 12~2월 겨울 · 3~5월 봄 · 6~8월 여름 · 9~11월 가을. **물결은 여름의 전유물**: 다른 계절은
// 물 없이 그 계절 장면만(가을 = 낙엽 물리, 겨울 = 눈밭·발자국, 봄 = 풀밭·나비 — 전부 위에서 내려다보는 시점,
// season-canvas.tsx). 계절 배경 스위치 OFF면 **전부** 내려간다(개정 2, 2026-09-04: 물결도 여름의 것이라 OFF에 남지
// 않는다).
// 오행 보정(docs/ux/seasonal-ambient-plan.md §3): 봄은 햇빛(火) 대신 초목(木)·이슬(水), 가을은 붉·주황·노랑
// 낙엽(火·조토 증폭) 대신 채도 낮춘 갈색·와인 잎 + 은빛 서리(金), 겨울은 눈(水의 결정 = 흰 金).
//
// 표시 게이트는 CSS(app/ambient.css · app/metal-water.css): 생동감 있는 동작 ON ∧ data-gfx≠soft ∧ ≥641px ∧ 계절 배경
// 스위치(`html[data-ambient="off"]`, lib/ui/motion.ts). gfx=lite는 엔진이 입자를 줄인다(lib/ui/gfx.ts v3). 특정일
// (성탄·할로윈·24절기)은 `SPECIAL_DAYS`에 추가한다 — 계절보다 우선(3단계, 아직 비어 있음 — 실제 날짜(KST)로 판정).

export type SeasonKey = "spring" | "summer" | "autumn" | "winter";
export const SEASON_KEYS: readonly SeasonKey[] = ["spring", "summer", "autumn", "winter"];
export function isSeasonKey(value: string | null | undefined): value is SeasonKey {
  return value !== null && value !== undefined && (SEASON_KEYS as readonly string[]).includes(value);
}

export type KstDate = { y: number; m: number; d: number };

// 오늘(KST) — 특정일 판정용. 서버(UTC)·클라이언트(어느 시간대든) 모두 같은 답. Non-negotiable 1.
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

// 달력 달(1~12) → 계절. 범위 밖 값은 여름(물결)으로 — 안전한 기본.
export function seasonOfMonth(month: number): SeasonKey {
  if (month === 12 || month === 1 || month === 2) return "winter";
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "summer";
}

export type SpecialDayKey = "christmas" | "halloween";
export type SpecialDay = {
  key: SpecialDayKey;
  label: string;
  // 그 날인가(KST 실제 날짜). 기간(예: 12/24~25)도 여기서 판단.
  match: (date: KstDate) => boolean;
};
// 3단계에서 채운다(성탄: 눈 + 표면 밖 여백의 트리·산타·루돌프 숨김 요소, 할로윈: 밝은 바탕 위 보랏빛 안개 —
// 붉·주황 증폭 금지). 지금은 비어 있어 계절만 판정한다.
export const SPECIAL_DAYS: readonly SpecialDay[] = [];

export type AmbientPick = { season: SeasonKey; day: SpecialDayKey | null };

export function pickAmbient(month: number, force?: SeasonKey | null, today: KstDate = kstToday()): AmbientPick {
  const season = force ?? seasonOfMonth(month);
  const day = force ? null : (SPECIAL_DAYS.find((s) => s.match(today))?.key ?? null);
  return { season, day };
}
