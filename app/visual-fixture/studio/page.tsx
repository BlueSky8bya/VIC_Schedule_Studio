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
import { isBiomeKey } from "@/components/shared/ambient/world/biomes";
import { sampleStudioSchedule } from "@/lib/schedules/sample-data";

// 비주얼/E2E 테스트 전용 fixture — 고정 샘플 데이터로 편집실 셸을 렌더한다(인증·DB 없이).
// 오버레이 스택(시청자 미리보기 → '이 달 기록' 시트) 회귀를 브라우저에서 실측하기 위한 페이지.
// `VISUAL_TEST_FIXTURE=1`일 때만 열리고, 프로덕션(플래그 없음)에서는 404 → 실사용자에게 안 노출.
export const dynamic = "force-dynamic";

export default async function VisualStudioFixture({
  searchParams,
}: {
  searchParams?: Promise<{ viewer?: string; role?: string; panel?: string; ambient?: string; hour?: string; weather?: string; y?: string; m?: string; biome?: string; chain?: string }>;
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
  // hour=13.5 · weather=rain|snow|fog|wind|cloud|clear → 세계 강제(띠·날씨). day는 2026-09-05 연대기 철거로 없앴다.
  const hour = sp?.hour !== undefined && Number.isFinite(Number(sp.hour)) ? Number(sp.hour) : undefined;
  const weatherKeys = ["clear", "cloud", "rain", "snow", "fog", "wind"] as const;
  const weather = weatherKeys.find((k) => k === sp?.weather);
  // biome=pond → 시작 바이옴(PLAN-004 검증 — 감상 모드에서 방향키 없이 바로 그 화면).
  const biome = isBiomeKey(sp?.biome) ? sp.biome : undefined;
  const worldForce = hour !== undefined || weather || biome ? { hour, weather, biome } : undefined;
  // y=2025&m=11 → 보는 달 강제(계절도 흔적도 **달**에서 나온다). 기본 2026-06.
  const y = sp?.y !== undefined && /^\d{4}$/.test(sp.y) ? Number(sp.y) : 2026;
  const m = sp?.m !== undefined && /^\d{1,2}$/.test(sp.m) && Number(sp.m) >= 1 && Number(sp.m) <= 12 ? Number(sp.m) : 6;
  return (
    <StudioShell
      ambientForce={ambient}
      ambientWorldForce={worldForce}
      actor={{
        email: "fixture-owner@example.com",
        isAuthenticated: true,
        role
      }}
      hasUnlockSession={false}
      schedule={
        // chain=1 → 6/8·6/9·6/10에 이어진 일정 셋(linkNext) 주입 — 체인 선택 링·이음변 회귀 실측용(2026-09-27).
        sp?.chain === "1"
          ? {
              ...sampleStudioSchedule,
              events: [
                ...sampleStudioSchedule.events,
                ...["08", "09", "10"].map((d, i) => ({
                  id: `chain-${d}`,
                  startsAt: `2026-06-${d}T20:00:00+09:00`,
                  endsAt: `2026-06-${d}T23:00:00+09:00`,
                  isAllDay: false,
                  publicTitle: `체인 ${i + 1}일차`,
                  status: "scheduled" as const,
                  visibilityScope: "public" as const,
                  category: "stream" as const,
                  tagIds: ["tag-big-server"],
                  primaryTagIds: ["tag-big-server"],
                  sortOrder: 1,
                  linkNext: i < 2 ? `chain-${["08", "09", "10"][i + 1]}` : undefined
                })),
                // 아직 안 풀린 떡밥 하나(6/12) — 떡밥 점선·선택 링 겹침 회귀 실측용.
                {
                  id: "fixture-teaser-studio",
                  startsAt: "2026-06-12T20:00:00+09:00",
                  endsAt: "2026-06-12T23:00:00+09:00",
                  isAllDay: false,
                  publicTitle: "떡밥 테스트",
                  status: "scheduled" as const,
                  visibilityScope: "public" as const,
                  category: "stream" as const,
                  tagIds: ["tag-big-server"],
                  primaryTagIds: ["tag-big-server"],
                  sortOrder: 1,
                  teaser: true,
                  teaserRevealAt: new Date(Date.now() + 86_400_000 * 3).toISOString()
                }
              ]
            }
          : sampleStudioSchedule
      }
      initialView={{ year: y, month: m }}
      initialViewerMode={viewer}
      initialNarrow={false}
      initialPanel={panel}
    />
  );
}
