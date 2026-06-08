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
  const schedule = await st.measure(
    "publicSchedule",
    () => getPublicSchedule(calendarSlug),
    "공개 스케줄 로드"
  );

  return NextResponse.json(schedule, { headers: { "Server-Timing": st.header() } });
}
