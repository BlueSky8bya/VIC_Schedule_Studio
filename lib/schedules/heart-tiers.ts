// 관심 하트 → 이 달 인기 순위 왕관(단일 출처). 시청자 포스터(카드 모서리 왕관·상세 배지·범례 필터)와 개발자
// 인사이트(기준 설명)가 같은 규칙을 쓰도록 여기 한 곳에 둔다.
//
// 2026-11-17 토리님 요청으로 개편: 테두리 링·광택(빤질빤질) 단계 4개(관심/높은/폭발/👑)를 없애고
// **이 달 하트 순위 1·2·3위에 금·은·동 왕관**만 붙인다. 순위는 하트 수가 같은 일정끼리 같은 등수(공동 1위 등),
// 다음 등수는 바로 다음 하트 수(빽빽한 순위) — 동점이 생겨도 기존 왕관이 사라지지 않는다.
// 하트가 너무 적은 일정(HEART_MIN 미만)은 순위에서 빠진다(두세 개로 왕관이 들썩이지 않게).
export const HEART_MIN = 5;
export const HEART_RANKS = 3;

export type HeartTier = {
  key: "gold" | "silver" | "bronze";
  rank: 1 | 2 | 3;
  label: string; // "이 달 1위"
  icon: string; // public 경로(노토 👑 금·은·동)
};

const TIERS: HeartTier[] = [
  { key: "gold", rank: 1, label: "이 달 1위", icon: "/crowns/gold.svg" },
  { key: "silver", rank: 2, label: "이 달 2위", icon: "/crowns/silver.svg" },
  { key: "bronze", rank: 3, label: "이 달 3위", icon: "/crowns/bronze.svg" }
];

// 이 달 일정별 하트 수 → 왕관을 받는 일정만 담은 표.
export function heartRankMap(counts: Iterable<readonly [string, number]>): Map<string, HeartTier> {
  const entries = [...counts].filter(([, c]) => c >= HEART_MIN);
  const distinct = [...new Set(entries.map(([, c]) => c))].sort((a, b) => b - a).slice(0, HEART_RANKS);
  const out = new Map<string, HeartTier>();
  for (const [id, c] of entries) {
    const i = distinct.indexOf(c);
    if (i >= 0) out.set(id, TIERS[i]);
  }
  return out;
}
