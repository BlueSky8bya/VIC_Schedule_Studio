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
    // 보는 달로 끝나는 6개월 — 과거 달(다시보기 시대)을 보고 있으면 그 시대의 트렌드가 나온다.
    getPublicBroadcastStats(6, { year, month }),
    getPublicBroadcastDaily(year, month)
  ]);

  return NextResponse.json(
    {
      months: months.map((m) => ({ ym: m.ym, hours: m.hours, days: m.days, sessions: m.sessions })),
      daily
    },
    {
      // 이 응답엔 개인 정보가 없다(집계만) → CDN에서 합쳐 람다 왕복을 줄인다. 단 방송시간은
      // 라이브성(방송 중 계속 자람)이라 짧게(60초) 캐시해 관리자 화면과 거의 실시간으로 맞춘다.
      // 캐시는 이 s-maxage 한 겹뿐(밑단 unstable_cache 제거, SWR 없음) — 여러 겹/SWR로 값이
      // 계단식으로 바뀌면 시청자가 오류인지 갱신 중인지 구분할 수 없다. 만료되면 모두 동시에 새 값.
      headers: { "Cache-Control": "public, s-maxage=60" }
    }
  );
}
