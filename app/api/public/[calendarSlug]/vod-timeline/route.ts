import { NextResponse } from "next/server";
import { getPublicVodTimeline } from "@/lib/schedules/public-loader";
import { publicRequestError, validatePublicRequest } from "@/app/api/public/request";

// 팬 타임라인(다시보기 챕터) 본문 — 시청자가 '챕터'를 펼칠 때만 부른다(0071, Phase 2 A안).
//
// 공개 경계: public-loader만 쓴다. 담기는 값은 숲 공개 댓글에서 파싱한 챕터(시각·라벨·코너)와
// 작성자 닉(팬 크레딧 표기용)뿐 — 계정·토큰·비공개 필드 없음. 응답은 익명 동일 → CDN 캐시.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ calendarSlug: string }> }
) {
  const { calendarSlug } = await params;
  const validated = validatePublicRequest(request, calendarSlug, ["titleNo"]);
  if (!validated.ok) return validated.response;
  const titleNo = Number(validated.query.get("titleNo"));
  if (!Number.isSafeInteger(titleNo) || titleNo <= 0) {
    return publicRequestError(400, "titleNo가 필요합니다.");
  }
  let timeline;
  try {
    timeline = await getPublicVodTimeline(titleNo);
  } catch {
    // A failed read is not an empty timeline: never retain failure at the CDN.
    return publicRequestError(503, "타임라인을 불러오지 못했습니다.");
  }
  return NextResponse.json(
    timeline ?? { authorNick: "", entries: [] },
    {
      // 60초 CDN 사본(2026-09-28): 창을 여닫을 때마다 함수+DB를 타던 것을 줄인다. 조정·늦은 추가는 1분 안에 반영된다.
      headers: { "Cache-Control": "public, max-age=0, s-maxage=60" }
    }
  );
}
