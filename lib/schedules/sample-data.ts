import type { StudioSchedule } from "@/lib/domain/schedule-types";
// 공개 안전 데이터(팔레트·태그·캘린더)는 공개 전용 파일에서 가져와 얹는다. 이 파일은 그 위에
// privateMeta·엠바고/작업 일정 같은 스튜디오 전용/비공개 데이터만 추가한다.
import {
  defaultPalette,
  defaultTags,
  publicCalendarMeta,
  samplePublicScheduleData
} from "@/lib/schedules/sample-public-data";

// 하위 호환: 예전에 이 모듈에서 팔레트/태그를 import하던 곳을 위해 재노출(단일 정의는 공개 파일).
export { defaultPalette, defaultTags } from "@/lib/schedules/sample-public-data";

export const sampleStudioSchedule: StudioSchedule = {
  calendar: publicCalendarMeta,
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
      // 기간 안내 띠 샘플(fixture 회귀용, 2026-09-03) — 편집실 팝오버·리더 라인·삭제 버튼의
      // 하늘색 테마와 '이 기간 안내 삭제' 라벨을 브라우저에서 실측하려면 저장된 period 띠가 필요.
      id: "sup-period-001",
      startsAt: "2026-06-08T00:00:00+09:00",
      endDateKey: "2026-06-11",
      isSupport: true,
      supportKind: "period",
      supportUrl: "https://example.com/alpha-test",
      isAllDay: true,
      publicTitle: "샘플 알파테스트 기간",
      status: "scheduled",
      visibilityScope: "public",
      category: "stream",
      tagIds: [],
      primaryTagIds: [],
      sortOrder: 0
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
      visibilityScope: "owner_private",
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
  // 미리보기는 서버 공개 스냅샷만 쓰므로(P0-SEC-2) 샘플에서도 공개 샘플 데이터를 그대로 쓴다 —
  // 비워두면 fixture/오프라인 미리보기가 빈 달력으로 보여 실물과 다르다.
  viewerModePreview: samplePublicScheduleData
};
