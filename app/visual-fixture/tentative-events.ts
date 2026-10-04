// 비주얼 fixture 전용(tent=1) — 미정·떡밥 표시 비교용 일정 묶음(2026-10-05).
// 같은 주(6/16~6/19)에 [미정 / 확정] · [떡밥+미정 / 떡밥] · [옅은 색 미정] · [긴 제목 2색 미정 종일]을 나란히 둬
// 한 장 캡처로 '미정'이 다른 표시(떡밥 점선·선택 링)와 헷갈리지 않는지 본다.
// revealed=false면 시청자 쪽 떡밥은 공개 로더의 가린 stub과 같은 모양(제목·태그 없음)으로 만든다.
import type { PublicScheduleEvent } from "@/lib/domain/schedule-types";

const IN_3_DAYS = () => new Date(Date.now() + 86_400_000 * 3).toISOString();

function base(id: string, day: string, title: string, tentative: boolean): PublicScheduleEvent {
  return {
    id,
    startsAt: `2026-06-${day}T20:00:00+09:00`,
    endsAt: `2026-06-${day}T23:00:00+09:00`,
    isAllDay: false,
    isTentative: tentative,
    publicTitle: title,
    status: "scheduled",
    visibilityScope: "public",
    category: "stream",
    tagIds: ["tag-big-server"],
    primaryTagIds: ["tag-big-server"],
    sortOrder: 5
  };
}

function teaser(id: string, day: string, tentative: boolean, masked: boolean): PublicScheduleEvent {
  if (!masked) return { ...base(id, day, "떡밥 방송", tentative), teaser: true, teaserRevealAt: IN_3_DAYS() };
  return {
    id,
    startsAt: `2026-06-${day}T00:00:00+09:00`,
    isAllDay: true,
    isTentative: tentative,
    publicTitle: "",
    status: "scheduled",
    visibilityScope: "public",
    category: "stream",
    tagIds: [],
    primaryTagIds: [],
    sortOrder: 5,
    teaser: true,
    teaserRevealAt: IN_3_DAYS()
  };
}

export function tentativeFixtureEvents(maskTeasers: boolean): PublicScheduleEvent[] {
  return [
    base("tent-16a", "16", "미정 합방", true),
    base("tent-16b", "16", "확정 합방", false),
    teaser("tent-17", "17", true, maskTeasers),
    teaser("tent-18", "18", false, maskTeasers),
    { ...base("tent-18b", "18", "옅은 색 미정", true), tagIds: ["tag-calm"], primaryTagIds: ["tag-calm"] },
    // 2색(시참의날+VRChat) 미정 종일 — 빗금이 2색 칠 위에도 깔리는지.
    { ...base("tent-19", "19", "아주 긴 제목의 미정 대회 연습", true), isAllDay: true, endsAt: undefined, tagIds: ["tag-song", "tag-calm"], primaryTagIds: ["tag-song", "tag-calm"] }
  ];
}
