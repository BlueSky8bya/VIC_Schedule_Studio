import { NextResponse } from "next/server";
import { getPublicSearchSuggest } from "@/lib/schedules/public-loader";
import { publicRequestError, validatePublicRequest } from "@/app/api/public/request";

// 입력 중 제안(0096) — Enter 전에 뜨는 우리 사이트 전용 관련 단어. 공개 말뭉치의 단어·인물·게임·장르뿐(검색어 저장 없음).
export async function GET(request: Request, { params }: { params: Promise<{ calendarSlug: string }> }) {
  const { calendarSlug } = await params;
  const validated = validatePublicRequest(request, calendarSlug, ["q"]);
  if (!validated.ok) return validated.response;
  const q = (validated.query.get("q") ?? "").slice(0, 60);
  let items: Awaited<ReturnType<typeof getPublicSearchSuggest>>;
  try {
    items = await getPublicSearchSuggest(q, 8);
  } catch {
    return publicRequestError(503, "Search suggestions unavailable");
  }
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200" } });
}
