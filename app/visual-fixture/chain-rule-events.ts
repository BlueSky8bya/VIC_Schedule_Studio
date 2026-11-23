import type { PublicScheduleEvent } from "@/lib/domain/schedule-types";

// 이어진 일정 잇기 규칙(2026-11-16, lib/calendar/month.ts buildChainJoins) 실측용 fixture — DB 쓰기 없음.
// 2026-06(fixture 기본 달)의 샘플 일정이 없는 날에 경우별로 깐다.
//  · 6/2→6/3→6/4 3일: 첫날 앞에 합방 → 곡선 + 띠
//  · 6/9→6/10 곡선: 9일 15시 합방 → 하종와, 10일 하종와(같은 글 → 한 줄) → 17시 합방
//  · 6/17→6/18 띠(글 다름): 17일 와우 하나뿐 → 칸마다 제 글, 평평한 변
//  · 6/23→6/24 띠(같은 글): 23일 하종와 하나뿐 → 두 칸 폭 한 장, 24일 17시 합방은 띠 아래
//  · 6/27(토)→6/28(일) 줄바뀜: 곡선 없이 평평한 변이 칸 끝까지 + 일요일 제목 앞 물결 표시
//  · 6/29→6/30 띠(2026-11-23): 29일 와우 아래에 노래 방송이 있어도 잇는다(둘 다 맨 위 → 같은 글 두 칸 띠)
//  · 8월 첫 주(2026-11-23 "어디에 끼워도 이어진다"): 8/3~8/6 나흘 묶음 — 3일은 다른 일정이 아래, 4일은 위, 5일은 위·아래 둘 다.
//    8/11~8/12 두 묶음이 같은 틈을 엇갈려 지난다(자리 나눔).
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
    // 왕관·하트가 달린 토→일 카드(2026-11-20) — 토요일 오른쪽 위 왕관이 옅어지는 끝에서도 진한지 실측. 이 달 1위.
    { ...ev("cr-27-run", "27", "주말 마라톤\n24시간 연속 방송", 1, "tag-big-server", "cr-28-run"), heartCount: 120 },
    ev("cr-28-run", "28", "주말 마라톤\n24시간 연속 방송", 0, "tag-big-server"),
    // 여러 날 한 장이 주를 넘는 경우(6/12 금 ~ 6/15 월) — 토 오른변·일 왼변(줄 경계)도 맞닿은 변 규칙(2026-11-20 실측).
    { ...ev("cr-span-week", "12", "주말 특집 4일 연속\n여러 날 한 장", 1, "tag-hype"), endDateKey: "2026-06-15" },
    // 6/25 — 한 칸에 세 장, 아래 두 장이 2·3위 왕관(손 올림으로 뜬 위 카드가 왕관을 덮지 않는지, 2026-11-20).
    ev("cr-25-a", "25", "14시 저챗\n근황 토크", 0, "tag-calm"),
    { ...ev("cr-25-b", "25", "18시 합방\n보드게임", 1, "tag-collab"), heartCount: 110 },
    { ...ev("cr-25-c", "25", "22시 노래\n신청곡", 2, "tag-song"), heartCount: 100 },

    // 6/11~6/14 — 아직 안 이은 같은 태그 4일(우클릭 끌어 잇기 → 이어진 묶음 어느 카드에서든 다음 날로 늘리기 실측, 2026-11-19).
    ...["11", "12", "13", "14"].map((d, i) => ev(`cr-ext-${d}`, d, `탐험 합숙 ${i + 1}일차`, 0, "tag-calm")),

    // 토→일 줄바뀜 색 페이드 실측(2026-11-19) — 다른 태그 색: 6/20(토)→6/21(일) 노래, 7/18(토)→7/19(일) 2색 카드.
    ev("cr-wf-20", "20", "주말 노래 릴레이\n신청곡 1부", 0, "tag-song", "cr-wf-21"),
    ev("cr-wf-21", "21", "주말 노래 릴레이\n신청곡 2부", 0, "tag-song"),
    { ...ev("cr-wf-18", "18", "합방 주간\n토요일 편", 0, "tag-collab", "cr-wf-19"), startsAt: "2026-07-18T20:00:00+09:00", tagIds: ["tag-collab", "tag-variety-game"], primaryTagIds: ["tag-collab", "tag-variety-game"] },
    { ...ev("cr-wf-19", "19", "합방 주간\n일요일 편", 0, "tag-collab"), startsAt: "2026-07-19T20:00:00+09:00", tagIds: ["tag-variety-game", "tag-collab"], primaryTagIds: ["tag-variety-game", "tag-collab"] },

    ev("cr-29-wow", "29", "와우 레이드\n검은바위 나락", 0, "tag-variety-game", "cr-30-wow"),
    ev("cr-29-song", "29", "20시 노래 방송\n신청곡 받아요", 1, "tag-song"),
    ev("cr-30-wow", "30", "와우 레이드\n검은바위 나락", 0, "tag-variety-game"),
    ...anywhere(),
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

function anywhere(): PublicScheduleEvent[] {
  const at = (e: PublicScheduleEvent, day: string) => ({ ...e, startsAt: `2026-08-${day}T20:00:00+09:00` });
  const wow = ["03", "04", "05", "06"].map((d, i, all) =>
    at(ev(`cr-any-${d}`, d, `와우 포에버\n노뱅종 ${i + 1}일차`, 1, "tag-big-server", all[i + 1] ? `cr-any-${all[i + 1]}` : undefined), d)
  );
  return [
    ...wow,
    at(ev("cr-any-03x", "03", "Trees Hate You", 2, "tag-variety-game"), "03"),
    at(ev("cr-any-04x", "04", "Trees Hate You", 0, "tag-variety-game"), "04"),
    at(ev("cr-any-05x", "05", "14시 저챗", 0, "tag-calm"), "05"),
    at(ev("cr-any-05y", "05", "22시 노래\n신청곡", 2, "tag-song"), "05"),
    // 두 묶음이 같은 틈을 지난다 — 11일: 합방(위)·마라톤(아래), 12일: 마라톤(위)·합방(아래)
    at(ev("cr-any-11p", "11", "합방 주간 1부", 0, "tag-collab", "cr-any-12p"), "11"),
    at(ev("cr-any-11q", "11", "마라톤 1일차", 1, "tag-hype", "cr-any-12q"), "11"),
    at(ev("cr-any-12q", "12", "마라톤 2일차", 0, "tag-hype"), "12"),
    at(ev("cr-any-12p", "12", "합방 주간 2부", 1, "tag-collab"), "12")
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
