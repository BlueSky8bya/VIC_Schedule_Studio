import { NextResponse } from "next/server";
import { getPublicSchedule } from "@/lib/schedules/public-loader";
import { ServerTiming } from "@/lib/perf/perf";
import { publicRequestError, validatePublicRequest } from "@/app/api/public/request";

type PublicEventsRouteProps = {
  params: Promise<{
    calendarSlug: string;
  }>;
};

export async function GET(request: Request, { params }: PublicEventsRouteProps) {
  const { calendarSlug } = await params;
  const validated = validatePublicRequest(request, calendarSlug, []);
  if (!validated.ok) return validated.response;
  const st = new ServerTiming();
  // 구간 계측 → Server-Timing 헤더로 내보내 브라우저 개발자도구 Network에 막대로 보인다(+[perf] 로그).
  // includeMyHeartIds:false — 공개 API에 개인 필드(내 하트 목록)를 싣지 않는다. 포스터 SSR은
  // 이 라우트가 아니라 로더를 직접 쓰므로 영향 없고, 응답이 익명 동일해져 아래 CDN 캐시가 안전해진다.
  let schedule: Awaited<ReturnType<typeof getPublicSchedule>>;
  try {
    schedule = await st.measure(
      "publicSchedule",
      () => getPublicSchedule(calendarSlug, { includeMyHeartIds: false }),
      "공개 스케줄 로드"
    );
  } catch {
    return publicRequestError(503, "Schedule unavailable");
  }

  return NextResponse.json(schedule, {
    headers: {
      "Server-Timing": st.header(),
      // 개인 정보가 없는 익명 응답 → Worker 엣지 캐시(lib/edge/public-api-cache.ts)가 이 수명대로 담는다.
      // 시청자 첫 화면이 창 밖 달을 이 API로 채우므로 편집 반영 지연 = 이 수명. 소유자 2026-11-26: 최대 1분까지 허용
      // → 30초 그대로 + 30초는 내주면서 뒤에서 새로 만듦(합 60초). 밑단 Data Cache는 쓰기마다 revalidateTag로 즉시 비워진다.
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30"
    }
  });
}
