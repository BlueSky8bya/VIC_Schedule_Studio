import { NextResponse } from "next/server";

// 토리님 SOOP 라이브 상태 — 우리 서버가 대신 폴링한다(시청자 브라우저가 SOOP를 직접
// 때리지 않게: CORS·남용 방지). 비공식 엔드포인트라 깨질 수 있어 실패하면 조용히 오프라인 처리.
// 공개-안전 응답만 반환(비공개 데이터와 무관).

export const dynamic = "force-dynamic";

const BJ_ID = process.env.SOOP_BJ_ID ?? "toryvac";
const LIVE_API = "https://live.sooplive.com/afreeca/player_live_api.php";
// SOOP를 이 간격으로만 두드린다(시청자 수와 무관 — 서버가 캐시해 SOOP 부하 고정).
// 짧을수록 뱅온/뱅종 반영이 빠르지만 비공식 API라 과도하면 차단 위험 → 20초가 균형.
const CACHE_TTL_MS = 20_000;

type LiveState = {
  isLive: boolean;
  bjId: string;
  bjNick: string | null;
  title: string | null;
  category: string | null;
  bno: string | null;
  watchUrl: string | null;
};

let cache: { at: number; data: LiveState } | null = null;

const offline = (): LiveState => ({
  isLive: false,
  bjId: BJ_ID,
  bjNick: null,
  title: null,
  category: null,
  bno: null,
  watchUrl: null,
});

async function fetchLive(): Promise<LiveState> {
  try {
    const res = await fetch(LIVE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
      },
      body: new URLSearchParams({ bid: BJ_ID, type: "live", player_type: "html5" }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return offline();
    const json = (await res.json()) as { CHANNEL?: Record<string, unknown> };
    const c = json.CHANNEL ?? {};
    // RESULT: 1 = 방송중, 0 = 오프라인. 그 외 값은 안전하게 오프라인 취급.
    if (Number(c.RESULT) !== 1) return offline();
    const bno = c.BNO != null ? String(c.BNO) : null;
    const cat = Array.isArray(c.CATEGORY_TAGS)
      ? (c.CATEGORY_TAGS[0] as string) ?? null
      : (c.CATE as string) ?? null;
    return {
      isLive: true,
      bjId: BJ_ID,
      bjNick: (c.BJNICK as string) ?? null,
      title: (c.TITLE as string) ?? null,
      category: cat,
      bno,
      watchUrl: bno ? `https://play.sooplive.com/${BJ_ID}/${bno}` : `https://www.sooplive.com/station/${BJ_ID}`,
    };
  } catch {
    return offline();
  }
}

export async function GET() {
  const now = Date.now();
  if (!cache || now - cache.at > CACHE_TTL_MS) {
    cache = { at: now, data: await fetchLive() };
  }
  return NextResponse.json(cache.data, {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=30" },
  });
}
