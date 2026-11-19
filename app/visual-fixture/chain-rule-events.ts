import type { PublicScheduleEvent } from "@/lib/domain/schedule-types";

// 이어진 일정 잇기 규칙(2026-11-16, lib/calendar/month.ts buildChainJoins) 실측용 fixture — DB 쓰기 없음.
// 2026-06(fixture 기본 달)의 샘플 일정이 없는 날에 경우별로 깐다.
//  · 6/2→6/3→6/4 3일: 첫날 앞에 합방 → 곡선 + 띠
//  · 6/9→6/10 곡선: 9일 15시 합방 → 하종와, 10일 하종와(같은 글 → 한 줄) → 17시 합방
//  · 6/17→6/18 띠(글 다름): 17일 와우 하나뿐 → 칸마다 제 글, 평평한 변
//  · 6/23→6/24 띠(같은 글): 23일 하종와 하나뿐 → 두 칸 폭 한 장, 24일 17시 합방은 띠 아래
//  · 6/27(토)→6/28(일) 줄바뀜: 곡선 없이 평평한 변이 칸 끝까지 + 일요일 제목 앞 물결 표시
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
    // 3일 묶음: 2일 앞에 합방 → 2→3일 곡선, 3→4일 띠(3일이 한 줄 머리, 4일 빈 자리)
    ev("cr-02-collab", "02", "14시 합방\n더빙게임", 0, "tag-collab"),
    ev("cr-02-hjw", "02", HJW, 1, "tag-full-track", "cr-03-hjw"),
    ev("cr-03-hjw", "03", HJW, 0, "tag-full-track", "cr-04-hjw"),
    ev("cr-04-hjw", "04", HJW, -1, "tag-full-track"),
    ev("cr-09-collab", "09", "15시 합방 w.뿡치헌콕\n더빙게임", 0, "tag-collab"),
    ev("cr-09-hjw", "09", HJW, 1, "tag-full-track", "cr-10-hjw"),
    ev("cr-10-hjw", "10", HJW, 0, "tag-full-track"),
    ev("cr-10-collab", "10", "17시 여교멤 합방\n더빙게임", 1, "tag-collab"),

    ev("cr-17-wow", "17", "와우 레이드\n1일차 - 검은바위 나락", 0, "tag-variety-game", "cr-18-wow"),
    ev("cr-18-wow", "18", "와우 레이드\n2일차 - 화산 심장부", 0, "tag-variety-game"),
    ev("cr-18-song", "18", "20시 노래 방송\n신청곡 받아요", 1, "tag-song"),

    // 하트(왕관) — 같은 글 띠의 머리·뒤 칸 일정이 각자 제 날짜 모서리에 왕관을 다는지 실측(2026-11-19). 이 달 1·2위.
    { ...ev("cr-23-hjw", "23", HJW, 0, "tag-full-track", "cr-24-hjw"), heartCount: 90 },
    { ...ev("cr-24-hjw", "24", HJW, 0, "tag-full-track"), heartCount: 80 },
    ev("cr-24-collab", "24", "17시 여교멤 합방\n더빙게임", 1, "tag-collab"),

    ev("cr-27-notice", "27", "13시 공지 방송", 0, "tag-hype"),
    ev("cr-27-run", "27", "주말 마라톤\n24시간 연속 방송", 1, "tag-big-server", "cr-28-run"),
    ev("cr-28-run", "28", "주말 마라톤\n24시간 연속 방송", 0, "tag-big-server"),

    // 6/11~6/14 — 아직 안 이은 같은 태그 4일(우클릭 끌어 잇기 → 이어진 묶음 어느 카드에서든 다음 날로 늘리기 실측, 2026-11-19).
    ...["11", "12", "13", "14"].map((d, i) => ev(`cr-ext-${d}`, d, `탐험 합숙 ${i + 1}일차`, 0, "tag-calm")),

    ev("cr-29-wow", "29", "와우 레이드\n검은바위 나락", 0, "tag-variety-game", "cr-30-wow"),
    ev("cr-29-song", "29", "20시 노래 방송\n신청곡 받아요", 1, "tag-song"),
    ev("cr-30-wow", "30", "와우 레이드\n검은바위 나락", 0, "tag-variety-game"),
    // 7월 첫 주 — 릴동파형(2026-11-17 소유자): 일 드래프트 → 월~수 같은 글 띠(제목 한 줄) → 목·금·토 각각 → 일 폐막식
    ...lildongpa(),
    // 7월 14~16일 — 맹든링형(2025-12 실데이터 모양): 1일차는 그날 두 번째, 2일차 다음날 혼자, 3일차는 미연결
    { ...ev("cr-md-14a", "14", "16시 풀트 소통뱅!", 0, "tag-full-track"), startsAt: "2026-07-14T16:00:00+09:00" },
    { ...ev("cr-md-14b", "14", "맹든링 1일차!", 1, "tag-big-server", "cr-md-15"), startsAt: "2026-07-14T20:00:00+09:00" },
    { ...ev("cr-md-15", "15", "16시 지하감옥 트라이\n맹든링 2일차!", 0, "tag-big-server"), startsAt: "2026-07-15T16:00:00+09:00" },
    { ...ev("cr-md-16a", "16", "16시 리캡, 별별랭킹보기!", 1, "tag-hype"), startsAt: "2026-07-16T16:00:00+09:00" },
    { ...ev("cr-md-16b", "16", "도감작과 모험하기\n맹든링 3일차!", 2, "tag-big-server"), startsAt: "2026-07-16T20:00:00+09:00" },
    // 7월 26~28일 — 롤 연습형(2026-01 실데이터 모양): 태그 둘(2색 카드), 같은 글 두 칸 띠 → 다른 글
    ...["26", "27", "28"].map((d, i) => ({
      ...ev(`cr-lol-${d}`, d, i < 2 ? "롤 연습" : "감왁대전 - 롤", 0, "tag-variety-game", i < 2 ? `cr-lol-${["27", "28"][i]}` : undefined),
      startsAt: `2026-07-${d}T20:00:00+09:00`,
      tagIds: ["tag-variety-game", "tag-collab"],
      primaryTagIds: ["tag-variety-game", "tag-collab"]
    }))
  ];
}

function lildongpa(): PublicScheduleEvent[] {
  const days = ["05", "06", "07", "08", "09", "10", "11", "12"];
  const titles = [
    "릴동파 드래프트 - 아바타요",
    "릴동파 연습",
    "릴동파 연습",
    "릴동파 연습",
    "릴동파 개막식 골프 출전",
    "릴동파 2일차 골프 출전",
    "릴동파 3일차 봅슬레이 출전",
    "릴동파 폐막식"
  ];
  return days.map((d, i) => ({
    ...ev(`cr-ld-${d}`, d, titles[i], 0, "tag-calm", i < days.length - 1 ? `cr-ld-${days[i + 1]}` : undefined),
    startsAt: `2026-07-${d}T20:00:00+09:00`
  }));
}
