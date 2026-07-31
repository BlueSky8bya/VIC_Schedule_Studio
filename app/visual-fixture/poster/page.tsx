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
  searchParams?: Promise<{ mode?: string }>;
}) {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") {
    notFound();
  }
  const decorate = (await searchParams)?.mode === "decorate";
  return (
    <PublicPoster
      anonymous
      accountSwitch={false}
      decorate={decorate}
      initialNarrow={false}
      initialYear={2026}
      initialMonth={6}
      schedule={samplePublicScheduleData}
    />
  );
}
