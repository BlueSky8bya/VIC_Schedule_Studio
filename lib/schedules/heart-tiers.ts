// 관심 하트 → 불꽃/왕관 배지 단계(단일 출처).
// 시청자 포스터(배지 표시)와 개발자 인사이트(기준 설명)가 같은 임계값을 쓰도록 여기 한 곳에 둔다.
//
// 작은 수에서 과장되지 않도록 "절대 하트 수"를 1차 기준으로 쓰고, 상위 단계는 "이 달 최다 대비
// 비율"까지 함께 충족해야 한다. 👑(최고 인기)는 이 달에 단 하나(유일한 1위)만 붙는다.
// 아래 임계값만 바꾸면 채널 규모에 맞게 쉽게 조정된다(포스터·인사이트 동시 반영).
export const HEART_MIN = 5; // 이 수 미만이면 배지 없음(2~3개로 들썩이지 않게)
export const HEART_HOT = 12; // 🔥🔥 높은 관심 최소 하트
export const HEART_BLAZE = 25; // 🔥🔥🔥 폭발적 관심 최소 하트
export const HEART_CROWN = 10; // 👑 최고 인기로 인정할 최소 하트(유일 1위일 때)
export const HEART_HOT_RATIO = 0.6; // 🔥🔥 추가 조건: 이 달 최다의 60% 이상
export const HEART_BLAZE_RATIO = 0.85; // 🔥🔥🔥 추가 조건: 이 달 최다의 85% 이상

export type HeartTier = { key: "warm" | "hot" | "blaze" | "top"; flames: string; label: string };

export function heartTier(count: number, max: number, isSoleTop: boolean): HeartTier | null {
  if (count < HEART_MIN) {
    return null; // 너무 적으면 표시하지 않는다(노이즈 방지).
  }
  // 이 달 최고 인기: "유일한 1위"이고 충분히 모였을 때만 — 딱 하나만 왕관.
  if (isSoleTop && count >= HEART_CROWN) {
    return { key: "top", flames: "👑", label: "최고 인기" };
  }
  const ratio = max > 0 ? count / max : 0;
  // 상위 단계는 절대 수 + 상대 비율을 모두 만족해야 한다(작은 max로 부풀지 않게).
  if (count >= HEART_BLAZE && ratio >= HEART_BLAZE_RATIO) {
    return { key: "blaze", flames: "🔥🔥🔥", label: "폭발적 관심" };
  }
  if (count >= HEART_HOT && ratio >= HEART_HOT_RATIO) {
    return { key: "hot", flames: "🔥🔥", label: "높은 관심" };
  }
  return { key: "warm", flames: "🔥", label: "관심" };
}
