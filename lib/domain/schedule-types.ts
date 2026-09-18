import type { DarkTagColors } from "@/lib/tags/dark-palette";

export const PRODUCT_TIMEZONE = "Asia/Seoul" as const;

// "developer"는 플랫폼 레벨 슈퍼관리자(시스템 유지보수자)로, "owner"(스트리머)와 구분된다.
// 개발자는 모든 캘린더를 읽고/편집할 수 있지만, 공개 API 출력은 동일하게 유지되고
// 비공개 레이어 읽기에는 여전히 잠금해제 세션이 필요하다.
// 역할 세 종류: 개발자·관리자(owner)·시청자. (worker 철수 2026-08-27 ADR-0015, manager(신뢰 멤버) 철수
// 2026-09-04 ADR-0018 — 멤버 관리 기능 자체가 프로젝트에서 빠졌다. 옛 행동 기록의 "manager" 문자열은
// 라벨 사전(lib/activity/labels.ts)이 판독용으로만 안다.)
export type MembershipRole = "developer" | "owner" | "viewer";

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
  darkColors?: DarkTagColors;
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
  darkColors?: DarkTagColors;
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
  // 합방 게스트 출연분(0075) — 다른 스트리머 방송국의 VOD면 호스트 닉("비밀소녀♥"). 토리님 본방은 없음.
  // 화면은 "합방 · ○○" 배지로 다른 채널임을 알린다(숲에서 누구나 보는 공개 닉).
  host?: string;
  // 그 호스트의 숲 아이디(0075 host_id) — 칩이 방송국(https://ch.sooplive.co.kr/{id})으로 가는 버튼이 되게(2026-09-17 소유자).
  // 공개 채널 주소의 일부라 비공개 아님.
  hostId?: string;
  // 방송이 실제로 시작한 시각(ISO, 2026-09-18 소유자: "타임라인에 실제 시간도"). 숲 VOD 등록 시각 − 길이로 계산하는데,
  // 우리 방송 세션 기록(broadcast_session.started_at)과 분 단위까지 일치한다(실측 11/12). 공개 정보(등록 시각·길이)만 쓴다.
  startedAt?: string;
};

// 시청자 검색(0076, PLAN-20260918-023) — 공개 일정·다시보기·팬 타임라인 챕터를 한 순위로.
// 서버 RPC 한 행 = 한 적중. 클라이언트는 날짜별로 묶어 보여준다(lib/search/group.ts).
export type PublicSearchHitKind = "event" | "vod" | "chapter";
export type PublicSearchHit = {
  kind: PublicSearchHitKind;
  eventId?: string; // kind=event
  titleNo?: number; // kind=vod|chapter — /replay/<날짜>?part 와 시킹의 키
  sec?: number; // kind=chapter — 방송 내 초
  dateKey: string; // YYYY-MM-DD(KST)
  startTime?: string; // kind=event, HH:MM
  title: string; // 일정 제목 | 다시보기 제목 | 챕터 라벨
  snippet: string; // 일정: 설명 발췌 · 챕터: 소속 다시보기 제목 · 그 외 ""
  durationMs?: number; // kind=vod|chapter
  hostNick?: string; // 합방 게스트 출연분(0075)이면 호스트 닉
  thumb?: string; // 다시보기 썸네일 SnapshotLoad 쿼리(0092) — 편집실처럼 VOD 목록이 없는 곳도 썸네일을 그린다
  score: number;
  exact: boolean; // 정규화 구/토큰이 실제로 포함된 적중(false = 트라이그램 유사도만 — 화면은 '비슷한 결과')
  popularity: number; // 0~1 참여 신호(다시보기: 조회·좋아요·댓글·챕터 밀도 / 일정: 하트) — 정렬 '인기순'
  section?: string; // kind=chapter — 팬 타임라인 [코너](노래뱅·빅이봤·소통…). 맥락 표시·코너 적중
  parent?: string; // kind=chapter — "ㄴ" 세부 항목의 상위 항목 라벨
  matchedOn?: string; // 어디에 맞았나: title|label|section|tag|description|related|abbrev|fuzzy
};
// 관계 그래프(0079) — 질의 인물과 함께 자주 나온 인물. 이름은 공개 제목·챕터의 "○○님"에서 온다.
export type PublicSearchRelated = {
  name: string; // 정규화 이름
  display: string; // 원문 표기(님 없음)
  coDocs: number; // 같은 방송/일정에 함께 나온 수
  hapbang: number; // 그중 합방 표식
  visits: number; // 채팅에만 나온(놀러온) 방송 수(0090) — 합방은 아니어도 친분 근거
};
export type PublicSearchTrend = { term: string; recent: number; ratio: number };
// 입력 중 제안(0096) — 우리 말뭉치 단어·인물·게임·장르. Enter 전에 아래로 뜬다(유튜브식).
export type PublicSearchSuggest = { term: string; kind: "term" | "person" | "game" | "genre" | "related"; weight: number };
// 관련 검색어(0080) — 큐레이션(rel: 같은 시리즈, 할나~실크송) 또는 말뭉치 공출현(auto).
export type PublicSearchRelatedTerm = { term: string; coDocs: number; kind: "rel" | "auto" };
export type PublicSearchResult = {
  query: string;
  hits: PublicSearchHit[];
  related?: { people: PublicSearchRelated[]; terms: PublicSearchRelatedTerm[] };
  corrected?: string; // 영타·오타 교정이 적용됐으면 실제로 찾은 말("shfo" → "노래")
  failed?: boolean; // RPC 오류(마이그레이션 순간 등) — 라우트가 503·no-store로 보내 CDN에 빈 결과가 굳지 않게(2026-09-18 '무릎' 사고)
};

// 팬 타임라인 본문(챕터 목록) — 시각(초)·라벨·팬이 적은 코너 헤더.
export type PublicVodTimeline = {
  authorNick: string;
  // depth = 팬이 "ㄴ"로 매단 세부 항목의 계층(0/없음 = 최상위). UI는 들여쓰기로만 쓴다.
  entries: { sec: number; label: string; section: string | null; depth?: number }[];
};

// 다시보기 채팅 구간 프로필(0090) — **비율만**(방송 안 최대 대비 0~1). 숫자(메시지·발화자 수)는 절대 내보내지 않는다(소유자).
export type PublicVodChatProfile = {
  binSec: number; // 구간 길이(초)
  laughTier: "high" | null; // 메시지당 웃음이 전체 상위 25%면 high
  bins: { i: number; h: number; d: number; l: number; t: string[] }[]; // h=반응, d=발화 밀도, l=웃음, t=상위 단어
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
