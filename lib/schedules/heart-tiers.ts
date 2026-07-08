// 관심 하트 → 불꽃/왕관 배지 단계(단일 출처).
// 시청자 포스터(배지 표시)와 개발자 인사이트(기준 설명)가 같은 임계값을 쓰도록 여기 한 곳에 둔다.
//
// 단계는 "절대 하트 수"로만 정한다(비율 조건 없음). 예전엔 상위 단계에 "이 달 최다 대비 비율"을
// 함께 걸었는데, 그러면 '다른 일정'에 하트가 쌓여 최다치가 오를 때 이 일정의 비율이 떨어져 배지가
// 내려가/사라져 보였다("하트를 뺀 것도 아닌데 배지가 사라짐"). 절대 수만 쓰면 다른 일정의 하트가
// 이 일정 배지에 영향을 주지 않는다(단조 — 하트를 더하면 올라가기만, 남의 하트로 안 내려간다).
// 👑(최고 인기)는 이 달 최다치와 같은 일정에 붙는다. 공동 1위면 함께 왕관 → 동점을 만들어도
// 기존 왕관이 사라지지 않는다(엄밀히 더 높은 일정이 나오면 그때만 왕관이 옮겨간다).
export const HEART_MIN = 5; // 이 수 미만이면 배지 없음(2~3개로 들썩이지 않게)
export const HEART_HOT = 12; // 🔥🔥 높은 관심 최소 하트
export const HEART_BLAZE = 25; // 🔥🔥🔥 폭발적 관심 최소 하트
export const HEART_CROWN = 10; // 👑 최고 인기로 인정할 최소 하트(이 달 최다일 때)

export type HeartTier = { key: "warm" | "hot" | "blaze" | "top"; flames: string; label: string };

// isTop = 이 일정의 하트가 '이 달 최다'와 같은가(공동 1위 포함).
export function heartTier(count: number, isTop: boolean): HeartTier | null {
  if (count < HEART_MIN) {
    return null; // 너무 적으면 표시하지 않는다(노이즈 방지).
  }
  // 최고 인기 왕관 — 이 달 최다(공동 1위 포함) + 충분히 모임.
  if (isTop && count >= HEART_CROWN) {
    return { key: "top", flames: "👑", label: "최고 인기" };
  }
  // 상위 단계는 절대 하트 수만으로(남의 하트에 영향받지 않게).
  if (count >= HEART_BLAZE) {
    return { key: "blaze", flames: "🔥🔥🔥", label: "폭발적 관심" };
  }
  if (count >= HEART_HOT) {
    return { key: "hot", flames: "🔥🔥", label: "높은 관심" };
  }
  return { key: "warm", flames: "🔥", label: "관심" };
}
