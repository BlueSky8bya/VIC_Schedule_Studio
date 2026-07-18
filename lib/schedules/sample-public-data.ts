// 공개 전용 샘플 데이터 — Supabase 미설정 환경의 공개 포스터/공개 API 폴백.
//
// 공개 경계(.claude/rules/public-private-boundary.md): 이 파일에는 **공개해도 안전한 데이터만** 둔다
// (일정 공개 필드·태그·팔레트·공개 업도움·공개 스티커·시청자 제안). privateMeta·엠바고/작업 일정·
// requests(요청 payload)·viewerModePreview 같은 스튜디오 전용/비공개 데이터는 절대 넣지 않는다.
// studio 샘플(`sample-data.ts`)이 이 파일을 import해 비공개 필드를 얹어 확장한다(역방향 import 금지).

import type {
  BroadcastTag,
  CalendarMeta,
  ColorPaletteEntry,
  Proposal,
  PublicSchedule,
  PublicScheduleEvent
} from "@/lib/domain/schedule-types";
import { PRODUCT_TIMEZONE } from "@/lib/domain/schedule-types";

// 명도·채도까지 흔들어 구분한 색 (DB seed 0010_distinct_palette_v3.sql와 동일). 색은 공개 데이터.
export const defaultPalette: ColorPaletteEntry[] = [
  { key: "gray", name: "회색", bgColor: "#cdd2da", textColor: "#2b2f38", borderColor: "#9aa0ab", sortOrder: 1 },
  { key: "red", name: "빨강", bgColor: "#d11a2a", textColor: "#ffffff", borderColor: "#a8121f", sortOrder: 2 },
  { key: "orange", name: "주황", bgColor: "#f5a623", textColor: "#5a3300", borderColor: "#d6760c", sortOrder: 3 },
  { key: "yellow", name: "노랑", bgColor: "#ffe14d", textColor: "#5f4a00", borderColor: "#e3bf17", sortOrder: 4 },
  { key: "lime", name: "초록", bgColor: "#4e9e2f", textColor: "#ffffff", borderColor: "#3a7a1f", sortOrder: 5 },
  { key: "mint", name: "민트", bgColor: "#9fe8c4", textColor: "#0c4a32", borderColor: "#5cc497", sortOrder: 6 },
  { key: "teal", name: "청록", bgColor: "#0e8a80", textColor: "#ffffff", borderColor: "#0a625c", sortOrder: 7 },
  { key: "sky", name: "하늘", bgColor: "#a9dbf5", textColor: "#08405a", borderColor: "#5cb6e0", sortOrder: 8 },
  { key: "blue", name: "파랑", bgColor: "#2f63d6", textColor: "#ffffff", borderColor: "#1f49a8", sortOrder: 9 },
  { key: "indigo", name: "남색", bgColor: "#5a44c2", textColor: "#ffffff", borderColor: "#4131a0", sortOrder: 10 },
  { key: "lavender", name: "보라", bgColor: "#d8bdf2", textColor: "#43176b", borderColor: "#b78fe0", sortOrder: 11 },
  { key: "pink", name: "분홍", bgColor: "#ee5aa3", textColor: "#ffffff", borderColor: "#d63b89", sortOrder: 12 },
  { key: "beige", name: "갈색", bgColor: "#a9794a", textColor: "#ffffff", borderColor: "#885d33", sortOrder: 13 },
  { key: "silver", name: "은색", bgColor: "#6b7682", textColor: "#ffffff", borderColor: "#4b535c", sortOrder: 14 }
];

// 시드 태그는 전부 대분류(parentId: null). 세부는 owner가 편집기에서 추가. 태그 이름/색은 공개 데이터.
export const defaultTags: BroadcastTag[] = ([
  { id: "tag-dayoff", tagKey: "dayoff", displayName: "휴뱅", colorKey: "gray", sortOrder: 1, isDefault: true, isActive: true },
  { id: "tag-worldcup", tagKey: "worldcup", displayName: "구플뱅", colorKey: "orange", sortOrder: 2, isDefault: true, isActive: true },
  { id: "tag-collab", tagKey: "collab", displayName: "합방", colorKey: "lavender", sortOrder: 3, isDefault: true, isActive: true },
  { id: "tag-big-server", tagKey: "big_server", displayName: "서버", colorKey: "blue", sortOrder: 4, isDefault: true, isActive: true },
  { id: "tag-full-track", tagKey: "full_track", displayName: "풀트뱅", colorKey: "pink", sortOrder: 5, isDefault: true, isActive: true },
  { id: "tag-calm", tagKey: "calm", displayName: "VRChat", colorKey: "mint", sortOrder: 6, isDefault: true, isActive: true },
  { id: "tag-variety-game", tagKey: "variety_game", displayName: "종겜", colorKey: "yellow", sortOrder: 7, isDefault: true, isActive: true },
  { id: "tag-song", tagKey: "song", displayName: "시참의날", colorKey: "sky", sortOrder: 8, isDefault: true, isActive: true },
  { id: "tag-hype", tagKey: "hype", displayName: "소통뱅", colorKey: "lime", sortOrder: 9, isDefault: true, isActive: true },
  { id: "tag-easy", tagKey: "easy", displayName: "기타", colorKey: "beige", sortOrder: 10, isDefault: true, isActive: true },
  { id: "tag-ck", tagKey: "ck", displayName: "CK", colorKey: "red", sortOrder: 11, isDefault: true, isActive: true },
  { id: "tag-tournament", tagKey: "tournament", displayName: "대회", colorKey: "indigo", sortOrder: 12, isDefault: true, isActive: true },
  { id: "tag-cineti", tagKey: "cineti", displayName: "시네티", colorKey: "teal", sortOrder: 13, isDefault: true, isActive: true }
] as Omit<BroadcastTag, "parentId" | "kind">[]).map((t) => ({ ...t, parentId: null, kind: "content" as const }));

// 공개 캘린더 메타(슬러그·표시 이름 등 — 전부 공개). studio 샘플도 이걸 그대로 쓴다.
export const publicCalendarMeta: CalendarMeta = {
  slug: "vic",
  displayName: "빅토리 일정표",
  title: "빅토리 일정표",
  timezone: PRODUCT_TIMEZONE,
  defaultYear: 2026,
  defaultMonth: 6,
  publicMemo: "",
  posterTheme: "none"
};

// 시청자 제안(공개 제출 아이디어). 공개 API는 이 중 'accepted'만 노출한다(라우트에서 필터).
export const sampleProposals: Proposal[] = [
  {
    id: "prop-001",
    type: "content",
    content: "6월 중순 공포게임 후보 투표",
    voteCount: 42,
    state: "reviewing",
    suggestedDate: "2026-06-15"
  }
];

// 공개 일정(공개 범위·비-draft만). privateMeta·엠바고/작업 일정은 여기 없다. PublicScheduleEvent 형태
// 그대로(= 예전 public-loader의 toPublicEvent 산출물과 동일). isTentative는 공개해도 안전한 상태값.
const publicEvents: PublicScheduleEvent[] = [
  {
    id: "evt-001",
    startsAt: "2026-06-01T20:00:00+09:00",
    endsAt: "2026-06-01T23:00:00+09:00",
    isAllDay: false,
    isTentative: false,
    publicTitle: "픽크타 1일차",
    publicDescription: "6월 첫 방송",
    status: "scheduled",
    visibilityScope: "public",
    category: "stream",
    tagIds: ["tag-big-server"],
    primaryTagIds: ["tag-big-server"],
    sortOrder: 1
  },
  {
    id: "evt-002",
    startsAt: "2026-06-04T20:00:00+09:00",
    endsAt: "2026-06-04T23:00:00+09:00",
    isAllDay: false,
    isTentative: false,
    publicTitle: "픽크타 4일차\n고멤 오버워치 CK",
    status: "scheduled",
    visibilityScope: "public",
    category: "collab",
    tagIds: ["tag-collab", "tag-variety-game"],
    primaryTagIds: ["tag-collab", "tag-variety-game"],
    sortOrder: 1
  },
  {
    id: "evt-003",
    startsAt: "2026-06-07T00:00:00+09:00",
    isAllDay: true,
    isTentative: false,
    publicTitle: "휴뱅",
    status: "scheduled",
    visibilityScope: "public",
    category: "dayoff",
    tagIds: ["tag-dayoff"],
    primaryTagIds: ["tag-dayoff"],
    sortOrder: 1
  },
  {
    id: "evt-004",
    startsAt: "2026-06-15T20:00:00+09:00",
    endsAt: "2026-06-15T23:00:00+09:00",
    isAllDay: false,
    isTentative: false,
    publicTitle: "폴트뱅",
    status: "scheduled",
    visibilityScope: "public",
    category: "stream",
    tagIds: ["tag-full-track"],
    primaryTagIds: ["tag-full-track"],
    sortOrder: 1
  },
  {
    id: "evt-005",
    startsAt: "2026-06-16T20:00:00+09:00",
    endsAt: "2026-06-16T23:30:00+09:00",
    isAllDay: false,
    isTentative: false,
    publicTitle: "시참의날\n발발랭킹\n갈틱쇼\n버블파이터 조금",
    status: "scheduled",
    visibilityScope: "public",
    category: "stream",
    tagIds: ["tag-variety-game", "tag-hype", "tag-calm"],
    primaryTagIds: ["tag-variety-game", "tag-hype"],
    sortOrder: 1
  },
  {
    id: "evt-006",
    startsAt: "2026-06-22T22:00:00+09:00",
    endsAt: "2026-06-23T00:30:00+09:00",
    isAllDay: false,
    isTentative: false,
    publicTitle: "폴트뱅\n10시이후\n라이츄팟+비몽 자랭",
    status: "scheduled",
    visibilityScope: "public",
    category: "stream",
    tagIds: ["tag-full-track", "tag-collab"],
    primaryTagIds: ["tag-full-track", "tag-collab"],
    sortOrder: 1
  }
];

// 완성된 공개 스케줄 폴백. 공개 업도움/스티커는 '이미 공개 필터를 통과한' 상태로만 담는다.
export const samplePublicScheduleData: PublicSchedule = {
  calendar: publicCalendarMeta,
  events: publicEvents,
  tags: defaultTags,
  palette: defaultPalette,
  supportCampaigns: [
    {
      id: "support-001",
      title: "업 도움 진행 중",
      description: "빅토리님을 도와주세요",
      label: "도우러 가기",
      url: "https://example.com/support",
      startsOn: "2026-06-10",
      endsOn: "2026-06-16",
      highlightColorKey: "lime",
      isPublic: true,
      isActive: true
    }
  ],
  stickers: [
    {
      id: "sticker-001",
      kind: "emoji",
      label: "⭐",
      year: 2026,
      month: 6,
      xRatio: 0.82,
      yRatio: 0.04,
      widthRatio: 0.06,
      rotationDeg: -12,
      flipX: false,
      flipY: false,
      opacity: 0.9,
      zIndex: 2,
      visiblePublicly: true
    },
    {
      id: "sticker-002",
      kind: "emoji",
      label: "🌸",
      year: 2026,
      month: 6,
      xRatio: 0.07,
      yRatio: 0.32,
      widthRatio: 0.07,
      rotationDeg: -18,
      flipX: false,
      flipY: false,
      opacity: 0.88,
      zIndex: 2,
      visiblePublicly: true
    }
  ],
  stickerAssets: [],
  heartCount: 0
};
