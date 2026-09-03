import { notFound } from "next/navigation";
// 실제 /studio는 (studio)/layout.tsx가 이 CSS들을 선로드한다 — fixture는 그 레이아웃 밖이라
// 직접 가져와야 프로덕션 빌드에서도 실물과 같은 스타일로 렌더된다(dev는 CSS를 전부 실어 가려짐).
// poster CSS도 필요: 편집실 모바일 아젠다(.agenda/.agenda-rail 골격)가 포스터 CSS의 기본
// 규칙을 공유한다 — 없으면 레일과 목록이 세로로 쌓여 실물과 다르게 보인다(실측).
import "@/components/studio/studio-shell.css";
import "@/components/studio/broadcast-panel.css";
import "@/components/poster/public-poster.css";
import { StudioShell } from "@/components/studio/studio-shell";
import { isSeasonKey } from "@/components/shared/ambient/registry";
import { sampleStudioSchedule } from "@/lib/schedules/sample-data";

// 비주얼/E2E 테스트 전용 fixture — 고정 샘플 데이터로 편집실 셸을 렌더한다(인증·DB 없이).
// 오버레이 스택(시청자 미리보기 → '이 달 기록' 시트) 회귀를 브라우저에서 실측하기 위한 페이지.
// `VISUAL_TEST_FIXTURE=1`일 때만 열리고, 프로덕션(플래그 없음)에서는 404 → 실사용자에게 안 노출.
export const dynamic = "force-dynamic";

export default async function VisualStudioFixture({
  searchParams,
}: {
  searchParams?: Promise<{ viewer?: string; role?: string; panel?: string; ambient?: string }>;
}) {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") {
    notFound();
  }
  const sp = await searchParams;
  const viewer = sp?.viewer === "1";
  // 역할별 화면 회귀 검증용(developer/owner — 매니저 철수 2026-09-04). viewer는 (studio) 가드 대상이라 제외.
  const role = sp?.role === "developer" ? sp.role : "owner";
  const panel = sp?.panel === "tags" ? sp.panel : undefined;
  // ambient=spring|summer|autumn|winter → 계절 레이어 강제(ADR-0017 검증용). 없으면 오늘(KST) 절기.
  const ambient = isSeasonKey(sp?.ambient) ? sp.ambient : undefined;
  return (
    <StudioShell
      ambientForce={ambient}
      actor={{
        email: "fixture-owner@example.com",
        isAuthenticated: true,
        role
      }}
      hasUnlockSession={false}
      schedule={sampleStudioSchedule}
      initialView={{ year: 2026, month: 6 }}
      initialViewerMode={viewer}
      initialNarrow={false}
      initialPanel={panel}
    />
  );
}
