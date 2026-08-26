// 관심 하트 → 단계(단일 출처). 시청자 포스터(테두리 링·👑·상세 배지)와 개발자 인사이트(기준 설명)가
// 같은 규칙을 쓰도록 여기 한 곳에 둔다.
//
// 2026-08-27 "이 달 최다 대비 비율 + 절대 하한" 하이브리드로 전환(사용자 결정). 절대 수(12/25)만 쓰던
// 동안 실제 분포(8월: 최다 12, 나머지 5~11)에선 '관심'과 👑만 남고 높은/폭발이 아예 안 나왔다.
// 비율이면 시청자 규모가 커져도 단계가 살아 있고, 절대 하한이 한두 개 하트로 들썩이는 노이즈를 막는다.
// 트레이드오프(알고 받아들임): 다른 일정에 하트가 쌓여 이 달 최다가 오르면 내 일정의 비율이 떨어져
// 단계가 내려갈 수 있다 — '이 달의 상대 인기'라는 뜻이라 본질적.
// 👑(최고 인기)는 이 달 최다치와 같은 일정에 붙는다. 공동 1위면 함께 왕관 → 동점을 만들어도
// 기존 왕관이 사라지지 않는다.
export const HEART_MIN = 5; // 이 수 미만이면 단계 없음(2~3개로 들썩이지 않게)
export const HEART_HOT_RATIO = 0.5; // 높은 관심: 이 달 최다의 50% 이상 …
export const HEART_HOT_MIN = 6; // … 이면서 최소 6개
export const HEART_BLAZE_RATIO = 0.8; // 폭발적 관심: 이 달 최다의 80% 이상 …
export const HEART_BLAZE_MIN = 8; // … 이면서 최소 8개
export const HEART_CROWN = 10; // 👑 최고 인기로 인정할 최소 하트(이 달 최다일 때)

export type HeartTier = { key: "warm" | "hot" | "blaze" | "top"; flames: string; label: string };

// count = 이 일정 하트 수, isTop = 이 달 최다와 같은가(공동 1위 포함), maxHeart = 이 달 최다 하트 수.
export function heartTier(count: number, isTop: boolean, maxHeart: number): HeartTier | null {
  if (count < HEART_MIN) {
    return null; // 너무 적으면 표시하지 않는다(노이즈 방지).
  }
  // 최고 인기 왕관 — 이 달 최다(공동 1위 포함) + 충분히 모임.
  if (isTop && count >= HEART_CROWN) {
    return { key: "top", flames: "👑", label: "최고 인기" };
  }
  const max = Math.max(maxHeart, count);
  if (count >= HEART_BLAZE_MIN && count >= max * HEART_BLAZE_RATIO) {
    return { key: "blaze", flames: "🔥🔥🔥", label: "폭발적 관심" };
  }
  if (count >= HEART_HOT_MIN && count >= max * HEART_HOT_RATIO) {
    return { key: "hot", flames: "🔥🔥", label: "높은 관심" };
  }
  return { key: "warm", flames: "🔥", label: "관심" };
}
