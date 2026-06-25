import { NextResponse } from "next/server";
import { recordLiveTick } from "@/lib/broadcast/session";
import { fetchSoopLive, type LiveState } from "@/lib/broadcast/soop";

// 토리님 SOOP 라이브 상태 — 우리 서버가 대신 폴링한다(시청자 브라우저가 SOOP를 직접
// 때리지 않게: CORS·남용 방지). 비공식 엔드포인트라 깨질 수 있어 실패하면 조용히 오프라인 처리.
// 공개-안전 응답만 반환(비공개 데이터와 무관). 실제 SOOP 호출은 lib/broadcast/soop(단일 출처).

export const dynamic = "force-dynamic";

// SOOP를 이 간격으로만 두드린다(시청자 수와 무관 — 서버가 캐시해 SOOP 부하 고정).
// 짧을수록 뱅온/뱅종 반영이 빠르지만 비공식 API라 과도하면 차단 위험 → 20초가 균형.
const CACHE_TTL_MS = 20_000;

let cache: { at: number; data: LiveState } | null = null;

export async function GET() {
  const now = Date.now();
  if (!cache || now - cache.at > CACHE_TTL_MS) {
    const data = await fetchSoopLive();
    cache = { at: now, data };
    // 방송 ON/OFF 세션 기록(개발자 인사이트용). fire-and-forget — 응답을 막지 않는다.
    void recordLiveTick({ isLive: data.isLive, title: data.title });
  }
  return NextResponse.json(cache.data, {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=30" }
  });
}
