import { notFound } from "next/navigation";
import { PublicPoster } from "@/components/poster/public-poster";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";

// 비주얼 회귀 테스트 전용 fixture 페이지 — 고정된 공개 샘플 데이터로 포스터를 렌더한다.
// 인증·DB·시각(오늘 강조는 6월 뷰라 안 걸림)에 의존하지 않아 매번 동일하게 나온다.
// `VISUAL_TEST_FIXTURE=1`일 때만 열리고, 프로덕션(플래그 없음)에서는 404 → 실사용자에게 안 노출.
// force-dynamic: 플래그를 요청 시점(런타임)에 읽는다(빌드 때 프리렌더로 굳어 404가 박히는 걸 방지).
export const dynamic = "force-dynamic";

export default async function VisualPosterFixture({
  searchParams
}: {
  searchParams?: Promise<{ mode?: string; avatar?: string; teaser?: string }>;
}) {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") {
    notFound();
  }
  const sp = await searchParams;
  const decorate = sp?.mode === "decorate";
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
  return (
    <PublicPoster
      anonymous
      accountSwitch={false}
      avatarSlot={avatar}
      decorate={decorate}
      initialNarrow={false}
      initialYear={2026}
      initialMonth={6}
      schedule={schedule}
    />
  );
}
