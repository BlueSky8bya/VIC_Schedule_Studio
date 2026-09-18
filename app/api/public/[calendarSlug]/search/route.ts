import { NextResponse } from "next/server";
import { searchPublic } from "@/lib/schedules/public-loader";

// 시청자 검색(0076, PLAN-20260918-023) — "예전에 이런 게 있었던 것 같은데 언제, 어디 시간대였지?"
//
// 공개 경계: public-loader만 쓴다. 담기는 값은 공개 일정(제목·설명 발췌·날짜·시각), 전체 공개
// 다시보기(제목·번호·길이), 팬 타임라인 챕터(초·라벨)뿐 — 비공개·엠바고·초안·미공개 떡밥·구독
// 전용 VOD는 RPC가 후보에서 뺀다. 응답은 익명 동일 → CDN 캐시. 검색어는 저장하지 않는다.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ calendarSlug: string }> }
) {
  const { calendarSlug } = await params;
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const result = await searchPublic(calendarSlug, q, Number.isFinite(limit) ? limit : 50);
  return NextResponse.json(result, {
    headers: {
      // 검색 결과는 일정 편집·다시보기 수집으로 바뀌지만 몇 분 늦어도 되는 화면이다(공개 일정
      // API와 같은 300초). 검색어별로 캐시 키가 갈리므로 CDN 적중률은 낮지만 람다 왕복 절감이
      // 목적이라기보다 같은 검색어 반복 입력(뒤로가기·재타이핑)을 흡수하는 용도.
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
    }
  });
}
