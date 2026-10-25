import { notFound } from "next/navigation";
import { supportContextFixture } from "../support-context";
import { PublicPoster } from "@/components/poster/public-poster";
import { isSeasonKey } from "@/components/shared/ambient/registry";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { buildPremiereFixture } from "@/lib/schedules/premiere-fixture";
import { tentativeFixtureEvents } from "../tentative-events";
import { parsePublicMonth } from "@/lib/ui/public-month-link";
import { isCompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";

// 비주얼 회귀 테스트 전용 fixture 페이지 — 고정된 공개 샘플 데이터로 포스터를 렌더한다.
// 인증·DB·시각(오늘 강조는 6월 뷰라 안 걸림)에 의존하지 않아 매번 동일하게 나온다.
// `VISUAL_TEST_FIXTURE=1`일 때만 열리고, 프로덕션(플래그 없음)에서는 404 → 실사용자에게 안 노출.
// force-dynamic: 플래그를 요청 시점(런타임)에 읽는다(빌드 때 프리렌더로 굳어 404가 박히는 걸 방지).
export const dynamic = "force-dynamic";

async function fixtureHeartAction() {
  "use server";
  // Nonpersistent control rendering only; this fixture never calls the real heart RPC.
  if (process.env.VISUAL_TEST_FIXTURE !== "1") return { ok: false as const, error: "테스트 화면이 아닙니다." };
  return { ok: true as const, count: 1 };
}

export default async function VisualPosterFixture({
  searchParams
}: {
  searchParams?: Promise<{ supportUX?: string; navSpan?: string; monthLink?: string; month?: string | string[]; avatar?: string; teaser?: string; fixed?: string; hearts?: string; ambient?: string; hour?: string; companionFood?: string; links?: string; plus?: string; signedIn?: string; tent?: string; premiere?: string; count?: string; gap?: string; scenario?: string; rehearsal?: string }>;
}) {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") {
    notFound();
  }
  const sp = await searchParams;
  const cozy = sp?.supportUX === "cozy" ? supportContextFixture() : null;
  const linkedMonth = sp?.monthLink === "1" ? parsePublicMonth(sp.month) : null;
  // teaser=<초> — 지금부터 N초 뒤 공개되는 '최초공개' 일정을 하나 끼워 넣는다(테스트 전용).
  // 시간에 걸린 기능이라 고정 샘플로는 검증이 안 된다: 공개 전 제목이 DOM에 새지 않는지,
  // 카운트다운이 0에서 실제로 공개 요청을 쏘는지를 브라우저에서 보려면 '곧 공개될 것'이 필요하다.
  const teaserIn = Number(sp?.teaser ?? "");
  const schedule =
    Number.isFinite(teaserIn) && teaserIn > 0
      ? {
          ...samplePublicScheduleData,
          events: [
            ...samplePublicScheduleData.events,
            {
              // 공개 로더가 만드는 '가린 stub'과 같은 모양 — 제목·태그·카테고리가 비어 있다.
              id: "fixture-teaser",
              startsAt: "2026-06-18T00:00:00+09:00",
              isAllDay: true,
              isTentative: false,
              publicTitle: "",
              status: "scheduled" as const,
              visibilityScope: "public" as const,
              category: "stream" as const,
              tagIds: [],
              primaryTagIds: [],
              sortOrder: 0,
              teaser: true,
              teaserRevealAt: new Date(Date.now() + teaserIn * 1000).toISOString()
            }
          ]
        }
      : samplePublicScheduleData;
  // avatar=1 → 아바타 자리 토글이 있는 소유자 scene을 fixture에서도 검증(스티커 좌표 매핑 실측용).
  const avatar = sp?.avatar === "1";
  // fixed=left|right → /onair(뱅송 미리보기)와 같은 고정 scene(토글 없음)을 fixture에서 검증.
  const fixed = sp?.fixed === "left" || sp?.fixed === "right" ? sp.fixed : undefined;
  // hearts=1 → 일정에 하트 집계를 순환 주입(6/24/40/45/0; 최다 45 기준 관심·높은·폭발·1위) — 관심 단계 링을
  // 시청자 fixture에서 검증. 지오메트리 게이트(기본 fixture)는 무영향.
  const hearts = sp?.hearts === "1";
  const shown = hearts
    ? {
        ...schedule,
        events: schedule.events.map((e, i) => ({ ...e, heartCount: [6, 24, 40, 45, 0][i % 5] }))
      }
    : schedule;
  // ambient=spring|summer|autumn|winter → 계절 레이어 강제(ADR-0017 검증용). 없으면 오늘(KST) 절기.
  const ambient = isSeasonKey(sp?.ambient) ? sp.ambient : undefined;
  // Same existing world-force input as the studio fixture. This guarded
  // synthetic route alone can select day/night; ordinary viewers keep KST.
  const requestedHour = sp?.hour === undefined ? undefined : Number(sp.hour);
  const hour = requestedHour !== undefined && Number.isFinite(requestedHour) && requestedHour >= 0 && requestedHour < 24 ? requestedHour : undefined;
  const withLinks = sp?.links === "1" ? {
    ...shown,
    events: [...shown.events,
      { ...shown.events[0], id: "fixture-untagged", startsAt: "2026-06-18T12:00:00+09:00", endsAt: undefined, publicTitle: "태그 없는 일정", tagIds: [], primaryTagIds: [] },
      { ...shown.events[0], id: "fixture-period", startsAt: "2026-06-19T12:00:00+09:00", endsAt: undefined, publicTitle: "기간 안내", tagIds: [], primaryTagIds: [], isSupport: true, supportKind: "period" as const, supportUrl: "https://example.com/fixture" },
      { ...shown.events[0], id: "fixture-period-same-end", startsAt: "2026-06-19T12:00:00+09:00", endsAt: undefined, endDateKey: "2026-06-19", publicTitle: "같은 날 종료 안내", tagIds: [], primaryTagIds: [], isSupport: true, supportKind: "period" as const, supportUrl: "https://example.com/fixture" },
      { ...shown.events[0], id: "fixture-period-multi", startsAt: "2026-06-19T12:00:00+09:00", endsAt: undefined, endDateKey: "2026-06-22", publicTitle: "여러 날 기간 안내", tagIds: [], primaryTagIds: [], isSupport: true, supportKind: "period" as const, supportUrl: "https://example.com/fixture" },
      { ...shown.events[0], id: "fixture-up", startsAt: "2026-06-20T12:00:00+09:00", endsAt: undefined, endDateKey: "2026-06-22", publicTitle: "업 도움", tagIds: [], primaryTagIds: [], isSupport: true, supportKind: "up" as const, supportUrl: "https://example.com/fixture" }
    ],
    vods: [
      { titleNo: 900000001, title: "샘플 다시보기", dateKey: "2026-06-18", durationMs: 7200000 },
      // plus=1 → 같은 날 구독 업로드(0155)·구독+ 다시보기(0154) 한 편씩 — 단계별 색 실측용(기준선 영향 없음).
      ...(sp?.plus === "1" ? [
        { titleNo: 900000002, title: "[기타] 샘플 먹는 영상!", dateKey: "2026-06-18", durationMs: 210000, access: "sub" as const },
        { titleNo: 900000003, title: "플러스뱅송 - 샘플", dateKey: "2026-06-18", durationMs: 3900000, access: "plus" as const }
      ] : [])
    ]
  } : shown;
  // tent=1 → 6/16~19에 미정·떡밥 비교 묶음(가린 떡밥 stub 포함) — 미정 표시 회귀 실측용(2026-10-05).
  const withTent = sp?.tent === "1" ? { ...withLinks, events: [...withLinks.events, ...tentativeFixtureEvents(true)] } : withLinks;
  const withNavigation = sp?.navSpan === "1" ? { ...withTent, events: [...withTent.events, {
    id: "fixture-nav-span", startsAt: "2026-05-31T20:00:00+09:00", endDateKey: "2026-06-03", isAllDay: false, publicTitle: "전월에서 이어진 공개 일정",
    status: "scheduled" as const, visibilityScope: "public" as const, category: "stream" as const, tagIds: ["tag-big-server"], primaryTagIds: ["tag-big-server"], sortOrder: 0
  }] } : withTent;
  const premiereSeconds = Number(sp?.premiere ?? sp?.teaser ?? "");
  const premiereFixture = Number.isFinite(premiereSeconds) && premiereSeconds > 0 ? {
    startedAt: Date.now(), offsets: Array.from({ length: Math.min(8, Math.max(1, Number(sp?.count) || 1)) }, (_, i) => premiereSeconds + i * (Number(sp?.gap) || 0)), scenario: sp?.scenario
  } : { startedAt: Date.now(), offsets: [], scenario: "empty" };
  const premiereSchedule = premiereFixture ? {
    ...withNavigation, events: [...withNavigation.events.filter(event => event.id !== "fixture-teaser"), ...buildPremiereFixture(premiereFixture.startedAt, premiereFixture.offsets, premiereFixture.startedAt).entries.map(entry => entry.event)]
  } : withNavigation;
  return (
    <PublicPoster
      ambientForce={ambient}
      ambientWorldForce={hour === undefined ? undefined : { hour, weather: "clear" }}
      fixtureCompanionFood={isCompanionFoodKind(sp?.companionFood) ? sp.companionFood : undefined}
      anonymous={sp?.signedIn !== "1"}
      toggleHeartAction={cozy ? fixtureHeartAction : undefined}
      accountSwitch={sp?.signedIn !== undefined || sp?.monthLink === "1"}
      syncMonthUrl={sp?.monthLink === "1"}
      avatarFixed={fixed}
      avatarSlot={avatar}
      initialNarrow={false}
      initialYear={cozy?.year ?? linkedMonth?.year ?? 2026}
      initialMonth={cozy?.month ?? linkedMonth?.month ?? 6}
      schedule={cozy ? { ...premiereSchedule, events: cozy.events } : premiereSchedule}
      premiereFixture={premiereFixture}
      premiereEnabled={Boolean(sp?.premiere)}
      previewNav={sp?.rehearsal === "1" ? <span>미리보기</span> : undefined}
      canRehearsePremiere={sp?.rehearsal === "1"}
    />
  );
}
