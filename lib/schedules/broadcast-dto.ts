// 방송 판서 창(B안, PLAN-20260725-001 M3) 전용 공개 DTO.
//
// 보안 계약(G0~G2 합의) — 이 파일이 판서 창의 '유일한' 데이터 입구다:
// - 입력은 서버가 만든 공개 스냅샷(`StudioSchedule.viewerModePreview` = public-loader 결과)만.
//   public-loader의 mapEvent가 teaser(미공개 떡밥)의 실제 제목·태그·기간을 이미 서버에서
//   제거한다(1차 방어선·단일 출처). 여기의 maskTeaser는 그 계약이 '깨졌을 때'를 위한
//   fail-closed 2차 방어선 — 서버 stub과 같은 형태로 강제 마스킹할 뿐, 서버 redaction을
//   대체하지 않는다. 편집실의 낙관적 studio events 재가공은 여전히 금지.
// - 모든 객체는 아래처럼 **필드를 하나하나 명시**해 만든다. spread(...) 금지 —
//   원본에 스튜디오 전용 필드가 늘어나도 여기로 새지 않는다(.claude/rules/public-private-boundary.md).
// - 태그는 raw tags/palette 배열 대신 색 해석이 끝난 최소 정보(BroadcastPanelTag)로 내장 —
//   판서 컴포넌트는 resolver·팔레트에 접근할 필요가 없다.
// - heartCount·supportUrl·linkNext·variant류는 판서에 불필요 → 의도적으로 제외(최소 필드 원칙).

import type { PublicSchedule, PublicScheduleEvent } from "@/lib/domain/schedule-types";
import { getEventDateKey, getEventsForDate } from "@/lib/calendar/month";
import { createTagVisualResolver } from "@/lib/tags/tag-visual";

export type BroadcastPanelTag = {
  id: string;
  label: string;
  /** 해석 완료된 배경색(#hex 또는 CSS 색). 팔레트에 없으면 null(무색 태그). */
  colorHex: string | null;
  isPrimary: boolean;
};

export type BroadcastPanelEvent = {
  id: string;
  publicTitle: string;
  publicDescription?: string;
  startsAt: string;
  endsAt?: string;
  endDateKey?: string;
  isAllDay: boolean;
  isTentative?: boolean;
  category: PublicScheduleEvent["category"];
  sortOrder: number;
  tags: BroadcastPanelTag[];
  /** 카드 배경 색 — 포스터와 '같은 규칙'(eventFills: 콘텐츠 대분류 ≤2, 2색=그라데이션).
   *  primary 태그 색 하나로 칠하면 형식/수식어 태그가 대표일 때 실제 달력과 색이 어긋난다. */
  fills: string[];
  /** 칸 색에 못 담은 나머지 색 점(eventExtras) — 포스터의 점 줄과 동일. */
  extraDots: string[];
  teaser?: boolean;
  teaserRevealAt?: string;
  /** 멀티데이일 때만: 이 날짜가 몇 일차인지(1-base)와 총 일수. 단일일은 undefined. */
  dayIndex?: number;
  dayTotal?: number;
};

export type BroadcastPanelDay = {
  /** KST 날짜 키(YYYY-MM-DD) — 판서 창 배치는 이 값의 사전순 = 시간순. */
  dateKey: string;
  events: BroadcastPanelEvent[];
};

/** YYYY-MM-DD(KST date-key) 간 일수 차. Date.UTC만 사용 — 로컬 타임존 무관(비협상 1: KST). */
function diffDateKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

// fail-closed(G2): teaser=true는 "서버가 가린 상태"라는 뜻이다. 입력이 서버 stub이 아니라
// 실제 내용을 실은 채 들어와도(계약 위반 소스 — 예: 낙관적 studio events를 잘못 물림) 여기서
// public-loader의 teaser stub(mapEvent)과 같은 모양으로 강제 마스킹한다: 날짜·공개 예정
// 시각·정렬만 남고 제목·설명·태그·시간·기간·카테고리는 전부 가린다. **날짜 배정 전에**
// 적용해야 가려진 기간(endDateKey)이 다른 날짜 카드로 번지지 않는다.
function maskTeaser(event: PublicScheduleEvent): PublicScheduleEvent {
  return {
    id: event.id,
    startsAt: `${getEventDateKey(event)}T00:00:00+09:00`,
    isAllDay: true,
    isTentative: false,
    publicTitle: "",
    status: event.status,
    visibilityScope: "public",
    category: "stream", // 서버 stub과 동일한 중립값 — 실제 카테고리도 가린다
    tagIds: [],
    primaryTagIds: [],
    sortOrder: event.sortOrder,
    teaser: true,
    teaserRevealAt: event.teaserRevealAt
  };
}

function toPanelEvent(
  event: PublicScheduleEvent,
  dateKey: string,
  tagLabelById: Map<string, string>,
  colorOf: (tagId: string) => string | null,
  fillsOf: (event: PublicScheduleEvent) => string[],
  extrasOf: (event: PublicScheduleEvent) => string[]
): BroadcastPanelEvent {
  // 이중 방어: 날짜 배정 전에 maskTeaser를 거쳤어도, 여기 단독 호출 경로가 생겨도 안전하게.
  if (event.teaser) {
    const stub = maskTeaser(event);
    return {
      id: stub.id,
      publicTitle: "",
      publicDescription: undefined,
      startsAt: stub.startsAt,
      endsAt: undefined,
      endDateKey: undefined,
      isAllDay: true,
      isTentative: undefined,
      category: stub.category,
      sortOrder: stub.sortOrder,
      tags: [],
      fills: [],
      extraDots: [],
      teaser: true,
      teaserRevealAt: stub.teaserRevealAt,
      dayIndex: undefined,
      dayTotal: undefined
    };
  }
  const primary = new Set(event.primaryTagIds);
  const tags: BroadcastPanelTag[] = event.tagIds.map((tagId) => ({
    id: tagId,
    label: tagLabelById.get(tagId) ?? "",
    colorHex: colorOf(tagId),
    isPrimary: primary.has(tagId)
  }));
  const startKey = getEventDateKey(event);
  const endKey = event.endDateKey ?? startKey;
  const total = diffDateKeys(startKey, endKey) + 1;
  return {
    id: event.id,
    publicTitle: event.publicTitle,
    publicDescription: event.publicDescription,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    endDateKey: event.endDateKey,
    isAllDay: event.isAllDay,
    isTentative: event.isTentative,
    category: event.category,
    sortOrder: event.sortOrder,
    tags,
    fills: fillsOf(event),
    extraDots: extrasOf(event),
    teaser: event.teaser,
    teaserRevealAt: event.teaserRevealAt,
    dayIndex: total > 1 ? diffDateKeys(startKey, dateKey) + 1 : undefined,
    dayTotal: total > 1 ? total : undefined
  };
}

/**
 * 판서 창에 보낼 날짜 묶음을 만든다. dateKeys는 중복 제거 + 시간순 정렬되어 나간다
 * (떨어진 토·일을 골라도 항상 날짜순으로 나란히).
 */
export function toBroadcastPanelDays(
  snapshot: PublicSchedule,
  dateKeys: string[]
): BroadcastPanelDay[] {
  const resolver = createTagVisualResolver(snapshot.tags, snapshot.palette);
  const tagLabelById = new Map(snapshot.tags.map((t) => [t.id, t.displayName] as const));
  const colorOf = (tagId: string) => resolver.visualOf(tagId).bg;
  // 카드 배경/점 줄은 포스터와 같은 규칙으로 — 색 문자열만 추출(팔레트 객체는 안 넘긴다).
  const fillsOf = (e: PublicScheduleEvent) => resolver.eventFills(e).map((c) => c.bgColor);
  const extrasOf = (e: PublicScheduleEvent) => resolver.eventExtras(e).map((c) => c.bgColor);
  // 방어선(defense-in-depth): 타입상 이미 public·non-draft지만, 잘못된 소스가 물려도
  // 비공개·draft가 절대 통과하지 못하게 런타임에서 한 번 더 거른다(string 확장 비교 —
  // 타입은 이미 좁혀져 있어 그대로 비교하면 TS가 '항상 참'이라며 거부한다).
  const safeEvents = snapshot.events
    .filter((e) => (e.visibilityScope as string) === "public" && (e.status as string) !== "draft")
    // teaser는 날짜 배정 전에 마스킹 — 가려진 기간이 다른 날짜로 번지는 것까지 차단(fail-closed).
    .map((e) => (e.teaser ? maskTeaser(e) : e));
  return [...new Set(dateKeys)].sort().map((dateKey) => ({
    dateKey,
    events: getEventsForDate(safeEvents, dateKey)
      .filter((e) => !e.isSupport) // 업 도움 띠는 기간 배너 — 날짜 카드 비교엔 소음이라 제외
      .map((e) => toPanelEvent(e, dateKey, tagLabelById, colorOf, fillsOf, extrasOf))
  }));
}
