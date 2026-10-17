import { normalizeCompanionHabits } from "./habits";

/** Describe the same three bounded motivations used by the behavior profile.
 * No inferred human history, care debt, identity or new persisted fields. */
export function companionHabitSummary(value: unknown): string {
  const habits = normalizeCompanionHabits(value), threshold = .12;
  const descriptions = [
    habits.sociability >= threshold ? "손길과 가까이 다가가는 걸 좋아해요" : habits.sociability <= -threshold ? "혼자 노는 시간을 조금 더 좋아해요" : "",
    habits.playfulness >= threshold ? "장난과 탐험을 자주 하고 싶어 해요" : habits.playfulness <= -threshold ? "천천히 둘러보며 쉬는 쪽을 좋아해요" : "",
    habits.confidence >= threshold ? "새로운 곳에도 조금 더 씩씩하게 다가가요" : habits.confidence <= -threshold ? "낯선 곳에서는 잠깐 살펴보고 움직여요" : "",
  ].filter(Boolean);
  return descriptions.length ? `${descriptions.join(". ")}.` : "아직 뚜렷하게 배운 습관은 없어요. 함께 지내며 조금씩 달라져요.";
}
