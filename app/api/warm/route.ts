import { NextResponse } from "next/server";
import { getPublicSchedule } from "@/lib/schedules/public-loader";

// 워밍 핑 전용(2026-09-28). 예전엔 5분마다 `/`를 두 곳(cron-job.org + GitHub)에서 두드려 매번 포스터를
// 통째로 SSR했다(544KB RSC 렌더 + 표본 기록 2건) — 하루 576번, Vercel Hobby Active CPU의 큰 몫.
// 함수 인스턴스를 깨워 두는 데는 어떤 라우트든 한 번이면 된다(Fluid: 앱 전체가 한 인스턴스). 여기서는
// 공개 스케줄 Data Cache만 만져(캐시가 따뜻하면 몇 ms, 식었으면 그때 한 번 다시 받는다) 첫 방문자의
// 렌더가 DB를 기다리지 않게 한다. 렌더는 하지 않는다. 방문·성능 표본에도 안 잡힌다(anon 로더만).
export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  let cached = true;
  try {
    await getPublicSchedule("vic", { includeMyHeartIds: false });
  } catch {
    cached = false;
  }
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Warm-Ms": String(Date.now() - t0),
      "X-Warm-Cache": cached ? "ok" : "miss"
    }
  });
}
