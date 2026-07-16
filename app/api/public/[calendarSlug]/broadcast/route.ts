import { NextResponse } from "next/server";
import { getPublicBroadcastDaily, getPublicBroadcastStats } from "@/lib/schedules/public-loader";

// 공개 방송 기록(집계) — 시청자 '이 달 기록' 시트가 열릴 때만 부른다(첫 페인트 비용 0).
//
// 공개 경계: public-loader만 쓴다(studio-loader·service-role 금지). 로더가 부르는 RPC는 집계만
// 돌려주고(0049 월별 / 0050 일별), broadcast_session 원본(시작·종료 시각, 방송 제목)은 RLS
// deny-all 그대로라 여기로도, 어디로도 나가지 않는다. 응답 DTO는 아래에서 명시적으로 조립한다.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ calendarSlug: string }> }
) {
  await params; // 단일 캘린더 앱 — slug는 라우트 형태 유지용.
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  const month = Number(url.searchParams.get("month"));
  const valid =
    Number.isInteger(year) && Number.isInteger(month) && month >= 1 && month <= 12 && year > 2000;
  if (!valid) {
    return NextResponse.json({ error: "year/month가 필요합니다." }, { status: 400 });
  }

  const [months, daily] = await Promise.all([
    getPublicBroadcastStats(6),
    getPublicBroadcastDaily(year, month)
  ]);

  return NextResponse.json(
    {
      months: months.map((m) => ({ ym: m.ym, hours: m.hours, days: m.days, sessions: m.sessions })),
      daily
    },
    {
      // 이 응답엔 개인 정보가 없다(집계만) → 시청자마다 람다를 왕복할 이유가 없다. 밑단 로더가
      // 이미 300초 unstable_cache라 값도 그 주기로만 바뀐다 → 같은 주기로 CDN에서 합친다.
      // stale-while-revalidate: 만료 직후 첫 사람도 기다리지 않고 옛 값을 받고, 갱신은 뒤에서.
      // (/api/soop-live가 이미 쓰는 방식.)
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" }
    }
  );
}
