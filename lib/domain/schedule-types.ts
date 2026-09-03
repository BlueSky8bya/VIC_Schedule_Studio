export const PRODUCT_TIMEZONE = "Asia/Seoul" as const;

// "developer"는 플랫폼 레벨 슈퍼관리자(시스템 유지보수자)로, "owner"(스트리머)와 구분된다.
// 개발자는 모든 캘린더를 읽고/편집할 수 있지만, 공개 API 출력은 동일하게 유지되고
// 비공개 레이어 읽기에는 여전히 잠금해제 세션이 필요하다.
export type MembershipRole = "developer" | "owner" | "manager" | "viewer"; // (worker 철수 2026-08-27, ADR-0015)

export type EventStatus = "draft" | "scheduled" | "live" | "done" | "cancelled";

export type EventVisibilityScope = "public" | "embargo" | "work" | "owner_private";

export type EventCategory = "stream" | "collab" | "notice" | "support" | "dayoff";

export type VariantPromotionState = "draft" | "active" | "promoted" | "archived";

// 팔레트 색 키. 기본 13색(gray·lavender·blue·pink·mint·yellow·orange·beige·sky·lime·red·indigo·teal)에
// 더해, 태그 추가 시 동적으로 생성되는 색(gen-XXXX)도 있으므로 string으로 둔다.
export type ColorKey = string;

export type ColorPaletteEntry = {
  key: ColorKey;
  name: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  sortOrder: number;
};

// 태그 축: content = 콘텐츠(셀 색·컨텐츠 통계 차지), modifier = 수식어(합방/시참/대회/짧뱅/풀트/구플 —
// 셀 색은 점으로만, 컨텐츠 순위서 제외, 피커 별칸). docs/tags/tag-taxonomy-classification.md 참고.
export type TagKind = "content" | "modifier";

export type BroadcastTag = {
  id: string;
  tagKey: string;
  displayName: string;
  colorKey: ColorKey;
  // 커스텀 색: 대분류가 직접 고른 hex(#RRGGBB). null/미지정이면 colorKey→color_palette 폴백.
  // 세부(자식)는 항상 null(부모 색 상속). 렌더 색 해석은 resolver(lib/tags/tag-visual)가 담당.
  bgHex?: string | null;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  // 2계층 태그: null = 대분류(색 보유), 값 = 세부(부모 id, 렌더 색은 최상위 대분류 색 상속).
  parentId: string | null;
  kind: TagKind;
  // 단계 배포: true면 분류 v3에서 새로 생긴 태그(레거시 뷰에서 숨김). 기본 false.
  v3Only?: boolean;
};

export type PublicScheduleEvent = {
  id: string;
  startsAt: string;
  endsAt?: string;
  endDateKey?: string; // 멀티데이 일정의 종료일(YYYY-MM-DD). 없으면 단일 날짜.
  isTentative?: boolean; // 아직 확정 아님(미정) — 공개해도 안전한 상태값. 카드에 점선+'미정' 표시.
  linkNext?: string; // 다음날 일정 id. 인접 쌍을 이으면 연속 막대로 그려진다.
  isSupport?: boolean; // 업 도움 기간이면 true
  // 띠의 종류(2026-09-01): 'up'(기본) = 숲에서 업 눌러 도와주는 기간(CTA '도와주러 가기'),
  // 'period' = 단순 기간 안내(알파테스트 등 — 도와주러 갈 필요 없음, CTA 없음, 링크는 선택).
  supportKind?: "up" | "period";
  supportUrl?: string; // 업 도움 링크(숲 게시글) 또는 기간 안내의 관련 URL(선택) — https만, 없으면 띠는 링크 없이 상세만
  isAllDay: boolean;
  publicTitle: string;
  publicDescription?: string;
  status: Exclude<EventStatus, "draft">;
  visibilityScope: "public";
  category: EventCategory;
  tagIds: string[];
  primaryTagIds: string[];
  sortOrder: number;
  variantGroupId?: string;
  variantLabel?: string;
  heartCount?: number; // A: 일정별 관심(하트) 집계 수. 숫자 자체는 노출하지 않고 "관심 높음" 판정에만 쓴다.
  // 최초공개 '기대돼요' 집계(0060) — 공개 전엔 기대 버튼 카운트, 공개 후엔 "n명이 기다렸어요" 배지.
  // 익명 집계 수만(토큰/계정 비노출) — 공개 안전.
  hopeCount?: number;
  // 떡밥(가림): 공개 시각 전엔 제목·태그를 숨기고 전용 룩 + 카운트다운만 보인다. 공개 시각이 지나면
  // 실제 내용이 보인다. 공개 DTO에는 가려진 동안에만 teaser=true가 실리고, 실제 제목/태그는 서버에서
  // 빠진다(공개 전 유출 방지). 공개 후엔 평범한 일정으로 내려온다.
  teaser?: boolean;
  teaserRevealAt?: string; // 공개 시각(ISO·UTC). teaser=true일 때만.
};

export type PrivateEventMeta = {
  eventId: string;
  privateTitle?: string;
  privateMemo?: string;
  editorNote?: string;
};

export type StudioScheduleEvent = Omit<PublicScheduleEvent, "status" | "visibilityScope"> & {
  status: EventStatus;
  visibilityScope: EventVisibilityScope;
  privateMeta?: PrivateEventMeta;
};

export type VariantGroup = {
  id: string;
  name: string;
  promotionState: VariantPromotionState;
  promotedEventId?: string;
};

// (P2-PROTO-1: Proposal/RequestItem/SupportCampaign 타입 제거 — 초기 프로토타입의 잔재로,
//  UI 소비자·실데이터 쓰기 경로가 전혀 없었다. 업 도움은 이벤트 단위 is_support/support_url이 정본.)

// C9/C10: 포스터 테마 팩(계절/배경). 미리 정의된 키만 허용한다.
export const POSTER_THEMES = [
  { key: "none", label: "기본" },
  { key: "sakura", label: "봄" },
  { key: "summer", label: "여름" },
  { key: "autumn", label: "가을" },
  { key: "winter", label: "겨울" },
  // P3: 더 화려한 배경(그라데이션/패턴). 텍스트 대비 위해 전부 밝게 유지.
  { key: "sunset", label: "노을" },
  { key: "mint", label: "민트" },
  { key: "dot", label: "도트" },
  { key: "starry", label: "별밤" },
  { key: "confetti", label: "꽃가루" },
  // 물빛(2026-09-03, 오행 레이어 P2): 안개·은백 종이 + 물빛 크롬. 밝기·대비 규칙은 그대로(밝게 유지),
  // 색만 바뀐다 — 카드·태그·띠·하트 등 의미색은 손대지 않는다. 특별한 날 빵빠레도 이 테마에선 쿨톤.
  { key: "mist", label: "물빛" }
] as const;
export type PosterThemeKey = (typeof POSTER_THEMES)[number]["key"];
export function isPosterThemeKey(value: string): value is PosterThemeKey {
  return POSTER_THEMES.some((theme) => theme.key === value);
}

// B: 메모 한 줄 — 줄마다 가로 정렬과 들여쓰기 단계를 따로 갖는다.
export type MemoLine = {
  text: string;
  align: "left" | "center" | "right";
  indent: number; // 0~4 단계, 단계당 일정 px 들여쓰기
};

export type CalendarMeta = {
  slug: string;
  displayName: string;
  title: string;
  timezone: typeof PRODUCT_TIMEZONE;
  defaultYear: number;
  defaultMonth: number;
  publicMemo: string;
  posterTheme: PosterThemeKey; // C9/C10: 적용된 포스터 테마
  memoAlign?: "left" | "center" | "right"; // #5: 메모 가로 정렬
  memoVAlign?: "top" | "center" | "bottom"; // #5: 메모 세로 위치
  memoLines?: MemoLine[]; // B: 줄별 정렬·들여쓰기. 있으면 이걸로 렌더, 없으면 publicMemo 줄바꿈 폴백
};

// 숲 다시보기(VOD) 링크(0068) — 공개 메타데이터만(SOOP에서 누구나 보는 값). 칩 라벨은
// VOD 제목을 그대로 쓴다(2026-08-31 사용자 결정 — '다시보기'보다 내용이 보인다).
// 플레이어 URL은 클라가 titleNo로 조립한다(vod.sooplive.co.kr/player/{titleNo}).
export type PublicVodEntry = {
  dateKey: string; // 방송 시작일(KST, YYYY-MM-DD)
  titleNo: number;
  title: string;
  durationMs: number;
  // 팬 타임라인(0071) 요약 — **타임라인 항목 개수**(화면 표기 "타임라인 N개"; 챕터=[코너] 헤더 수는
  // 본문을 받아야 안다)·작성자 닉(크레딧). 본문(entries)은 무거워서 번들에 안 싣고 펼칠 때
  // /api/public/[slug]/vod-timeline에서 따로 받는다. 필드명은 0071 당시 이름 그대로(값 의미만 주석으로).
  chapters?: number;
  timelineBy?: string;
  // 대표 썸네일 쿼리(0072) — SnapshotLoad의 쿼리 문자열 전체(rowKey=...&column=...&t=...).
  // column·t가 **스트리머가 지정한 썸네일 지점**을 담는다(2026-09-01 실측: 숲 웹 카드와 동일
  // URL) — rowKey만 남기면 0초/대기화면 컷으로 퇴화한다. URL 공통 접두는 클라가 조립:
  // https://videoimg.sooplive.com/php/SnapshotLoad.php?{thumbQuery}
  thumbQuery?: string;
};

// 팬 타임라인 본문(챕터 목록) — 시각(초)·라벨·팬이 적은 코너 헤더.
export type PublicVodTimeline = {
  authorNick: string;
  entries: { sec: number; label: string; section: string | null }[];
};

export type PublicSchedule = {
  calendar: CalendarMeta;
  events: PublicScheduleEvent[];
  tags: BroadcastTag[];
  palette: ColorPaletteEntry[];
  vods?: PublicVodEntry[]; // 다시보기 아카이브(없으면 빈 취급 — 샘플/오프라인 모드)
  myHeartIds?: string[]; // A: 현재 로그인 사용자가 관심 표시한 일정 id 목록(본인 것만, 개인 상태 복원용)
};

export type StudioSchedule = Omit<PublicSchedule, "events"> & {
  viewerModePreview: PublicSchedule;
  events: StudioScheduleEvent[];
  variantGroups: VariantGroup[];
};
