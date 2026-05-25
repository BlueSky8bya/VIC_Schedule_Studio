import type {
  BroadcastTag,
  ColorPaletteEntry,
  StudioSchedule
} from "@/lib/domain/schedule-types";
import { PRODUCT_TIMEZONE } from "@/lib/domain/schedule-types";

// 명도·채도까지 흔들어 구분한 13색 (DB seed 0010_distinct_palette_v3.sql와 동일).
// 한류(초록~파랑) 칸은 어두움/밝음 교차 배치 + 앱 CSS 무늬로 추가 구분한다.
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
  { key: "beige", name: "갈색", bgColor: "#a9794a", textColor: "#ffffff", borderColor: "#885d33", sortOrder: 13 }
];

export const defaultTags: BroadcastTag[] = [
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
];

export const sampleStudioSchedule: StudioSchedule = {
  calendar: {
    slug: "vic",
    displayName: "빅토리 일정표",
    title: "빅토리 일정표",
    timezone: PRODUCT_TIMEZONE,
    defaultYear: 2026,
    defaultMonth: 6,
    publicMemo: "",
    posterTheme: "none"
  },
  palette: defaultPalette,
  tags: defaultTags,
  events: [
    {
      id: "evt-001",
      startsAt: "2026-06-01T20:00:00+09:00",
      endsAt: "2026-06-01T23:00:00+09:00",
      isAllDay: false,
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
      publicTitle: "폴트뱅\n10시이후\n라이츄팟+비몽 자랭",
      status: "scheduled",
      visibilityScope: "public",
      category: "stream",
      tagIds: ["tag-full-track", "tag-collab"],
      primaryTagIds: ["tag-full-track", "tag-collab"],
      sortOrder: 1
    },
    {
      id: "evt-007",
      startsAt: "2026-06-12T20:00:00+09:00",
      endsAt: "2026-06-12T22:30:00+09:00",
      isAllDay: false,
      publicTitle: "비공개 합방 리허설",
      status: "scheduled",
      visibilityScope: "embargo",
      category: "collab",
      tagIds: ["tag-collab"],
      primaryTagIds: ["tag-collab"],
      sortOrder: 1,
      privateMeta: {
        eventId: "evt-007",
        privateTitle: "게스트 실명 엠바고",
        privateMemo: "공개 전까지 방송 화면 공유 금지.",
        editorNote: "공개명은 합뱅 예정으로만 사용"
      }
    },
    {
      id: "evt-008",
      startsAt: "2026-06-19T19:00:00+09:00",
      endsAt: "2026-06-19T21:00:00+09:00",
      isAllDay: false,
      publicTitle: "썸네일/공지 작업",
      status: "scheduled",
      visibilityScope: "work",
      category: "notice",
      tagIds: ["tag-calm"],
      primaryTagIds: ["tag-calm"],
      sortOrder: 1,
      privateMeta: {
        eventId: "evt-008",
        privateTitle: "월말 공지 이미지 작업",
        privateMemo: "포스터용 문구와 SOOP 게시글 링크 점검.",
        editorNote: "작업자에게만 공유"
      }
    }
  ],
  variantGroups: [
    {
      id: "vg-001",
      name: "6월 중순 합방/대체 방송",
      promotionState: "active",
      promotedEventId: "evt-007"
    }
  ],
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
    },
    {
      id: "sticker-private",
      kind: "emoji",
      label: "💖",
      year: 2026,
      month: 6,
      xRatio: 0.2,
      yRatio: 0.1,
      widthRatio: 0.12,
      rotationDeg: 0,
      flipX: false,
      flipY: false,
      opacity: 1,
      zIndex: 3,
      visiblePublicly: false
    }
  ],
  stickerAssets: [],
  heartCount: 0,
  proposals: [
    {
      id: "prop-001",
      type: "content",
      content: "6월 중순 공포게임 후보 투표",
      voteCount: 42,
      state: "reviewing",
      suggestedDate: "2026-06-15"
    }
  ],
  requests: [
    {
      id: "req-001",
      source: "collab",
      title: "외부 게스트 합방 문의",
      state: "triaged",
      receivedAt: "2026-05-20T16:40:00+09:00",
      summary: "공개 전까지 엠바고 레이어에서만 확인합니다."
    }
  ],
  viewerModePreview: {
    calendar: {
      slug: "vic",
      displayName: "빅토리 일정표",
      title: "빅토리 일정표",
      timezone: PRODUCT_TIMEZONE,
      defaultYear: 2026,
      defaultMonth: 6,
      publicMemo: "",
      posterTheme: "none"
    },
    events: [],
    tags: defaultTags,
    palette: defaultPalette,
    supportCampaigns: [],
    stickers: [],
    stickerAssets: [],
    heartCount: 0
  }
};
