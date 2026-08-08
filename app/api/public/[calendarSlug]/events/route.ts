import { NextResponse } from "next/server";
import { getPublicSchedule } from "@/lib/schedules/public-loader";
import { ServerTiming } from "@/lib/perf/perf";

type PublicEventsRouteProps = {
  params: Promise<{
    calendarSlug: string;
  }>;
};

export async function GET(_request: Request, { params }: PublicEventsRouteProps) {
  const st = new ServerTiming();
  const { calendarSlug } = await params;
  // 구간 계측 → Server-Timing 헤더로 내보내 브라우저 개발자도구 Network에 막대로 보인다(+[perf] 로그).
  // includeMyHeartIds:false — 공개 API에 개인 필드(내 하트 목록)를 싣지 않는다. 포스터 SSR은
  // 이 라우트가 아니라 로더를 직접 쓰므로 영향 없고, 응답이 익명 동일해져 아래 CDN 캐시가 안전해진다.
  const schedule = await st.measure(
    "publicSchedule",
    () => getPublicSchedule(calendarSlug, { includeMyHeartIds: false }),
    "공개 스케줄 로드"
  );

  return NextResponse.json(schedule, {
    headers: {
      "Server-Timing": st.header(),
      // 개인 정보가 없는 익명 응답 → CDN에서 합쳐 람다 왕복을 줄인다(방송 라우트와 같은 한 겹 원칙,
      // SWR 없음). 주기는 밑단 Data Cache(300초)와 맞춘다. 편집 반영: 포스터(SSR)는 revalidateTag로
      // 즉시, 이 API만 최악 CDN 300 + Data Cache 300 = 몇 분 늦을 수 있다 — 외부 소비자용이라 허용.
      "Cache-Control": "public, s-maxage=300"
    }
  });
}
