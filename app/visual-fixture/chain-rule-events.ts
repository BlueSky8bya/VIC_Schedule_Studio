import type { PublicScheduleEvent } from "@/lib/domain/schedule-types";

// 이어진 일정 잇기 규칙(2026-11-16, lib/calendar/month.ts buildChainJoins) 실측용 fixture — DB 쓰기 없음.
// 2026-06(fixture 기본 달)의 샘플 일정이 없는 날에 경우별로 깐다.
//  · 6/9→6/10 곡선: 9일 15시 합방 → 하종와, 10일 하종와(같은 글 → 한 줄) → 17시 합방
//  · 6/17→6/18 띠(글 다름): 17일 와우 하나뿐 → 칸마다 제 글, 평평한 변
//  · 6/23→6/24 띠(같은 글): 23일 하종와 하나뿐 → 두 칸 폭 한 장, 24일 17시 합방은 띠 아래
//  · 6/27(토)→6/28(일) 줄바뀜: 곡선 없이 "27일부터"
//  · 6/29→6/30 끊김: 29일 와우 뒤에 노래 방송 → 잇지 않는다
const HJW = "하종와\n낮의와우와 밤의와우를 보자\n던전 - 저습지,달라란,놈리건\n레벨업 위주!";

function ev(
  id: string,
  day: string,
  publicTitle: string,
  sortOrder: number,
  tag: string,
  linkNext?: string
): PublicScheduleEvent {
  return {
    id,
    startsAt: `2026-06-${day}T20:00:00+09:00`,
    isAllDay: false,
    publicTitle,
    status: "scheduled",
    visibilityScope: "public",
    category: "stream",
    tagIds: [tag],
    primaryTagIds: [tag],
    sortOrder,
    linkNext
  };
}

export function chainRuleFixtureEvents(): PublicScheduleEvent[] {
  return [
    ev("cr-09-collab", "09", "15시 합방 w.뿡치헌콕\n더빙게임", 0, "tag-collab"),
    ev("cr-09-hjw", "09", HJW, 1, "tag-full-track", "cr-10-hjw"),
    ev("cr-10-hjw", "10", HJW, 0, "tag-full-track"),
    ev("cr-10-collab", "10", "17시 여교멤 합방\n더빙게임", 1, "tag-collab"),

    ev("cr-17-wow", "17", "와우 레이드\n1일차 - 검은바위 나락", 0, "tag-variety-game", "cr-18-wow"),
    ev("cr-18-wow", "18", "와우 레이드\n2일차 - 화산 심장부", 0, "tag-variety-game"),
    ev("cr-18-song", "18", "20시 노래 방송\n신청곡 받아요", 1, "tag-song"),

    ev("cr-23-hjw", "23", HJW, 0, "tag-full-track", "cr-24-hjw"),
    ev("cr-24-hjw", "24", HJW, 0, "tag-full-track"),
    ev("cr-24-collab", "24", "17시 여교멤 합방\n더빙게임", 1, "tag-collab"),

    ev("cr-27-notice", "27", "13시 공지 방송", 0, "tag-hype"),
    ev("cr-27-run", "27", "주말 마라톤\n24시간 연속 방송", 1, "tag-big-server", "cr-28-run"),
    ev("cr-28-run", "28", "주말 마라톤\n24시간 연속 방송", 0, "tag-big-server"),

    ev("cr-29-wow", "29", "와우 레이드\n검은바위 나락", 0, "tag-variety-game", "cr-30-wow"),
    ev("cr-29-song", "29", "20시 노래 방송\n신청곡 받아요", 1, "tag-song"),
    ev("cr-30-wow", "30", "와우 레이드\n검은바위 나락", 0, "tag-variety-game")
  ];
}
