import { NextResponse } from "next/server";
import { getPublicVodTimeline } from "@/lib/schedules/public-loader";

// 팬 타임라인(다시보기 챕터) 본문 — 시청자가 '챕터'를 펼칠 때만 부른다(0071, Phase 2 A안).
//
// 공개 경계: public-loader만 쓴다. 담기는 값은 숲 공개 댓글에서 파싱한 챕터(시각·라벨·코너)와
// 작성자 닉(팬 크레딧 표기용)뿐 — 계정·토큰·비공개 필드 없음. 응답은 익명 동일 → CDN 캐시.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ calendarSlug: string }> }
) {
  await params; // 단일 캘린더 앱 — slug는 라우트 형태 유지용.
  const url = new URL(request.url);
  const titleNo = Number(url.searchParams.get("titleNo"));
  if (!Number.isFinite(titleNo) || titleNo <= 0) {
    return NextResponse.json({ error: "titleNo가 필요합니다." }, { status: 400 });
  }
  const timeline = await getPublicVodTimeline(titleNo);
  return NextResponse.json(
    timeline ?? { authorNick: "", entries: [] },
    {
      // 타임라인은 느리게 변한다(팬이 며칠에 걸쳐 다듬음) — 1시간 CDN 캐시면 충분하고,
      // 증분 수집(broadcast-poll 30분)과 합쳐 최악 1.5시간 지연. 개인 정보 없음 → public 캐시 안전.
      headers: { "Cache-Control": "public, s-maxage=3600" }
    }
  );
}
