import { NextResponse } from "next/server";
import { getPublicSearchRelated, getPublicSearchRelatedTerms, searchPublic } from "@/lib/schedules/public-loader";
import { publicRequestError, validatePublicRequest } from "@/app/api/public/request";

type SearchBundle = {
  result: Awaited<ReturnType<typeof searchPublic>>;
  people: Awaited<ReturnType<typeof getPublicSearchRelated>>;
  terms: Awaited<ReturnType<typeof getPublicSearchRelatedTerms>>;
};
// Only live promises, never a query/result cache. Bound distinct concurrent keys
// and release them after all three reads settle, including partial failures.
const pendingSearches = new Map<string, Promise<SearchBundle>>();
function readSearch(calendarSlug: string, q: string, limit: number): Promise<SearchBundle> {
  const key = JSON.stringify([calendarSlug, q, limit]);
  const pending = pendingSearches.get(key);
  if (pending) return pending;
  if (pendingSearches.size >= 128) return Promise.reject(new Error("Search busy"));
  const owned = Promise.allSettled([
    searchPublic(calendarSlug, q, limit),
    getPublicSearchRelated(q, 8),
    getPublicSearchRelatedTerms(q, 8)
  ]).then(([result, people, terms]) => {
    if (result.status !== "fulfilled" || people.status !== "fulfilled" || terms.status !== "fulfilled") {
      throw new Error("Search unavailable");
    }
    return { result: result.value, people: people.value, terms: terms.value };
  }).finally(() => { if (pendingSearches.get(key) === owned) pendingSearches.delete(key); });
  pendingSearches.set(key, owned);
  return owned;
}

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
  const validated = validatePublicRequest(request, calendarSlug, ["q", "limit"]);
  if (!validated.ok) return validated.response;
  const q = (validated.query.get("q") ?? "").slice(0, 100);
  const rawLimit = Number(validated.query.get("limit") ?? 50);
  // Match the existing public loader's floor/clamp/fallback semantics.
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(400, Math.floor(rawLimit))) : 50;
  // 관계 그래프 제안(0079)은 같은 왕복에 싣는다 — 시트가 요청을 두 번 하지 않게.
  let bundle: SearchBundle;
  try {
    bundle = await readSearch(calendarSlug, q, limit);
  } catch {
    return publicRequestError(503, "search unavailable");
  }
  const { result, people, terms } = bundle;
  if (result.failed) {
    // 검색 RPC 오류(함수 교체 순간·일시 장애) — 503 + no-store. 시트는 "잠시 안 돼요"를 보이고 재시도한다.
    return NextResponse.json({ error: "search unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ query: result.query, hits: result.hits, corrected: result.corrected,
    failed: result.failed, related: { people, terms } }, {
    headers: {
      // 검색 결과는 일정 편집·다시보기 수집으로 바뀌지만 몇 분 늦어도 되는 화면이다(공개 일정
      // API와 같은 300초). 검색어별로 캐시 키가 갈리므로 CDN 적중률은 낮지만 람다 왕복 절감이
      // 목적이라기보다 같은 검색어 반복 입력(뒤로가기·재타이핑)을 흡수하는 용도.
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600"
    }
  });
}
