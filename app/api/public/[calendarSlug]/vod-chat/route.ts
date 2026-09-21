import { NextResponse } from "next/server";
import { getPublicVodChatProfile } from "@/lib/schedules/public-loader";

// 다시보기 채팅 구간 프로필(0090) — 다시보기 창의 가로 띠가 부른다.
//
// 공개 경계: public-loader만. 담기는 값은 **비율뿐**(구간별 반응·발화 밀도·웃음 0~1, 상위 단어 ≤3, 웃음 등급).
// 메시지 수·발화자 수 같은 숫자는 RPC 단계에서 이미 없다(소유자 2026-09-18: 숫자 표기 금지). 응답 익명 동일 → CDN 캐시.
export async function GET(request: Request, { params }: { params: Promise<{ calendarSlug: string }> }) {
  await params;
  const url = new URL(request.url);
  const titleNo = Number(url.searchParams.get("titleNo"));
  if (!Number.isFinite(titleNo) || titleNo <= 0) {
    return NextResponse.json({ error: "titleNo가 필요합니다." }, { status: 400 });
  }
  const profile = await getPublicVodChatProfile(titleNo);
  return NextResponse.json(profile ?? { binSec: 30, laughTier: null, bins: [] }, {
    // Late source availability/recovery can change any archived VOD. Never pin an empty profile.
    headers: { "Cache-Control": profile ? "public, max-age=0, s-maxage=30" : "no-store" }
  });
}
