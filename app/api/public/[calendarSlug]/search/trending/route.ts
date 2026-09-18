import { NextResponse } from "next/server";
import { getPublicSearchTrending } from "@/lib/schedules/public-loader";

// 검색 시트 입력 전 제안(0079) — 최근 30일 챕터·제목에 갑자기 많이 나온 말. 공개 데이터만, 익명 동일.
export async function GET(_request: Request, { params }: { params: Promise<{ calendarSlug: string }> }) {
  await params; // 단일 캘린더 앱 — slug는 라우트 형태 유지용.
  const trends = await getPublicSearchTrending(30, 10);
  return NextResponse.json(
    { trends },
    // 하루 단위로 바뀌는 값 — 1시간 CDN 캐시.
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" } }
  );
}
