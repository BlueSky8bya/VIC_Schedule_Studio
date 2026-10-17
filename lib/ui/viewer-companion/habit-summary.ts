import { normalizeCompanionHabits } from "./habits";

export type CompanionHabitDescription = {
  key: "sociability" | "playfulness" | "confidence";
  label: string;
  description: string;
};

export const COMPANION_HABITS_EMPTY = "아직 뚜렷한 습관은 없어요.";

/** Describe the same three bounded motivations used by the behavior profile.
 * No inferred human history, care debt, identity or new persisted fields. */
export function companionHabitDescriptions(value: unknown): CompanionHabitDescription[] {
  const habits = normalizeCompanionHabits(value), threshold = .12;
  const descriptions: CompanionHabitDescription[] = [
    { key: "sociability", label: "교감", description: habits.sociability >= threshold ? "쓰다듬기와 곁에 있기" : habits.sociability <= -threshold ? "혼자 노는 시간" : "" },
    { key: "playfulness", label: "놀이", description: habits.playfulness >= threshold ? "장난치고 탐험하기" : habits.playfulness <= -threshold ? "느긋하게 쉬엄쉬엄" : "" },
    { key: "confidence", label: "새로운 곳", description: habits.confidence >= threshold ? "낯선 곳도 씩씩하게" : habits.confidence <= -threshold ? "먼저 살피고 천천히" : "" },
  ];
  return descriptions.filter(item => item.description);
}

export function companionHabitSummary(value: unknown): string {
  const descriptions = companionHabitDescriptions(value);
  return descriptions.length ? descriptions.map(item => item.description).join(" · ") : COMPANION_HABITS_EMPTY;
}
