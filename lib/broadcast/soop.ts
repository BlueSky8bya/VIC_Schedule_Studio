// 토리님 SOOP 라이브 상태 조회 — 단일 출처. 시청자용 라우트(app/api/soop-live)와 백업 cron
// (app/api/cron/broadcast-poll)이 같은 함수를 쓴다. 비공식 엔드포인트라 실패하면 조용히 오프라인.

export const BJ_ID = process.env.SOOP_BJ_ID ?? "toryvac";
const LIVE_API = "https://live.sooplive.com/afreeca/player_live_api.php";

export type LiveState = {
  isLive: boolean;
  bjId: string;
  bjNick: string | null;
  title: string | null;
  category: string | null;
  bno: string | null;
  watchUrl: string | null;
};

export const offlineState = (): LiveState => ({
  isLive: false,
  bjId: BJ_ID,
  bjNick: null,
  title: null,
  category: null,
  bno: null,
  watchUrl: null
});

export async function fetchSoopLive(): Promise<LiveState> {
  try {
    const res = await fetch(LIVE_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0"
      },
      body: new URLSearchParams({ bid: BJ_ID, type: "live", player_type: "html5" }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return offlineState();
    const json = (await res.json()) as { CHANNEL?: Record<string, unknown> };
    const c = json.CHANNEL ?? {};
    // RESULT: 1 = 방송중, 0 = 오프라인. 그 외 값은 안전하게 오프라인 취급.
    if (Number(c.RESULT) !== 1) return offlineState();
    const bno = c.BNO != null ? String(c.BNO) : null;
    const cat = Array.isArray(c.CATEGORY_TAGS)
      ? ((c.CATEGORY_TAGS[0] as string) ?? null)
      : ((c.CATE as string) ?? null);
    return {
      isLive: true,
      bjId: BJ_ID,
      bjNick: (c.BJNICK as string) ?? null,
      title: (c.TITLE as string) ?? null,
      category: cat,
      bno,
      watchUrl: bno
        ? `https://play.sooplive.com/${BJ_ID}/${bno}`
        : `https://www.sooplive.com/station/${BJ_ID}`
    };
  } catch {
    return offlineState();
  }
}
