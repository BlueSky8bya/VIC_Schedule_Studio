import { NextResponse } from "next/server";
import { getPublicSearchTrending } from "@/lib/schedules/public-loader";

// 검색 시트 입력 전 제안(0079) — 최근 2주 챕터·제목·채팅에 갑자기 많이 나온 말(0133: 반감기 3일 가중). 공개 데이터만, 익명 동일.
export async function GET(_request: Request, { params }: { params: Promise<{ calendarSlug: string }> }) {
  await params; // 단일 캘린더 앱 — slug는 라우트 형태 유지용.
  const trends = await getPublicSearchTrending(14, 10);
  return NextResponse.json(
    { trends },
    // 다시보기 채팅이 들어올 때마다 다시 계산된다(0133) — CDN 5분(공개 캐시 규약과 같은 300초).
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}
