import type { StudioSchedule } from "@/lib/domain/schedule-types";
import { PRODUCT_TIMEZONE } from "@/lib/domain/schedule-types";

export const sampleStudioSchedule: StudioSchedule = {
  calendar: {
    slug: "vic",
    displayName: "VIC Monthly Schedule",
    timezone: PRODUCT_TIMEZONE,
    month: "2026-06"
  },
  events: [
    {
      id: "evt-001",
      startsAt: "2026-06-03T20:00:00+09:00",
      endsAt: "2026-06-03T23:00:00+09:00",
      publicTitle: "주간 스프린트 방송",
      publicDescription: "이번 주 일정과 고정 코너를 함께 정리합니다.",
      status: "scheduled",
      category: "stream",
      privateMeta: {
        eventId: "evt-001",
        privateTitle: "스폰서 문구 최종 확인 필요",
        privateNotes: "20분 전 OBS 장면과 공지 이미지를 확인.",
        codename: "mint-room",
        workState: "confirmed"
      }
    },
    {
      id: "evt-002",
      startsAt: "2026-06-08T21:00:00+09:00",
      endsAt: "2026-06-08T23:30:00+09:00",
      publicTitle: "합방 예정",
      publicDescription: "공개 가능한 범위에서만 안내합니다.",
      status: "scheduled",
      category: "collab",
      variantGroupId: "vg-001",
      variantLabel: "A",
      privateMeta: {
        eventId: "evt-002",
        privateTitle: "게스트 이름 확인 전",
        privateNotes: "공개명 확정 전까지 합방 예정으로 유지.",
        codename: "blue-door",
        embargoUntil: "2026-06-06T12:00:00+09:00",
        workState: "waiting"
      }
    },
    {
      id: "evt-003",
      startsAt: "2026-06-15T19:30:00+09:00",
      endsAt: "2026-06-15T22:00:00+09:00",
      publicTitle: "시청자 추천 게임",
      status: "scheduled",
      category: "stream"
    },
    {
      id: "evt-004",
      startsAt: "2026-06-21T18:00:00+09:00",
      endsAt: "2026-06-21T19:00:00+09:00",
      publicTitle: "공지 정리",
      status: "draft",
      category: "notice",
      privateMeta: {
        eventId: "evt-004",
        privateTitle: "멤버십 공지 초안",
        privateNotes: "작업 모드에서만 노출되어야 합니다.",
        codename: "notice-draft",
        workState: "idea"
      }
    }
  ],
  supportCampaigns: [
    {
      id: "support-001",
      label: "후원 바로가기",
      url: "https://example.com/support",
      startsOn: "2026-06-01",
      endsOn: "2026-06-30"
    }
  ],
  proposals: [
    {
      id: "prop-001",
      type: "content",
      content: "6월 중순 공포게임 후보 투표",
      voteCount: 42,
      state: "reviewing"
    }
  ],
  requests: [
    {
      id: "req-001",
      source: "collab",
      title: "외부 게스트 합방 문의",
      state: "triaged"
    }
  ],
  viewerModePreview: {
    calendar: {
      slug: "vic",
      displayName: "VIC Monthly Schedule",
      timezone: PRODUCT_TIMEZONE,
      month: "2026-06"
    },
    events: [],
    supportCampaigns: []
  }
};
