import { NextResponse, after } from "next/server";
import { recordLiveTick } from "@/lib/broadcast/session";
import { fetchSoopLive, type LiveState } from "@/lib/broadcast/soop";
import { maybeSyncVodPipeline, maybeSyncTimelines } from "@/lib/broadcast/vod-timeline";
import { singleFlight, createWorkBudget } from "@/lib/broadcast/work-budget";

// 토리님 SOOP 라이브 상태 — 우리 서버가 대신 폴링한다(시청자 브라우저가 SOOP를 직접
// 때리지 않게: CORS·남용 방지). 비공식 엔드포인트라 깨질 수 있어 실패하면 조용히 오프라인 처리.
// 공개-안전 응답만 반환(비공개 데이터와 무관). 실제 SOOP 호출은 lib/broadcast/soop(단일 출처).

export const dynamic = "force-dynamic";
// after()의 다시보기 동기화가 응답 후에도 완주할 시간(Vercel Hobby 기본 10초 초과 방지).
export const maxDuration = 60;

// SOOP를 이 간격으로만 두드린다(시청자 수와 무관 — 서버가 캐시해 SOOP 부하 고정).
// 짧을수록 뱅온/뱅종 반영이 빠르지만 비공식 API라 과도하면 차단 위험 → 20초가 균형.
const CACHE_TTL_MS = 20_000;

let cache: { at: number; data: LiveState } | null = null;

const refresh = singleFlight(async () => {
  const data = await fetchSoopLive();
  // A slow request earns its TTL only after it has actually completed.
  cache = { at: Date.now(), data };
  // One lifetime owner, including the live tick. Concurrent misses must not
  // multiply background work, and request completion must not orphan it.
  after(async () => {
    const budget = createWorkBudget(50_000);
    await recordLiveTick({ isLive: data.isLive, title: data.title, bno: data.bno, startedAt: data.startedAt }, budget);
    await Promise.all([
      maybeSyncTimelines(budget).catch(() => {}),
      data.isLive ? Promise.resolve() : maybeSyncVodPipeline(budget).catch(() => {})
    ]);
  });
  return data;
});

export async function GET() {
  const now = Date.now();
  const data = cache && now - cache.at <= CACHE_TTL_MS ? cache.data : await refresh();
  // build: 서버의 현재 배포 커밋 — 시청자 탭이 오래 떠 있으면 데이터(이 폴링)는 최신인데
  // 코드/CSS는 옛 빌드로 남는다. 클라이언트가 자기 번들 해시와 비교해 새 배포를 감지한다
  // (public-poster의 숨김 시 자동 새로고침). 공개-안전: 커밋 해시는 편집실 빌드 태그로 이미 노출.
  return NextResponse.json(
    { ...data, build: process.env.APP_COMMIT ?? "dev" },
    {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=30" }
    }
  );
}
