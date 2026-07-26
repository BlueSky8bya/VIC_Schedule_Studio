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

// 방송국 API — 라이브 중일 때만 broad(방송번호·실제 시작시각)가 있다. 세션 기록기가
// '진짜 방송 시작 시각'(broad_start, KST 문자열)을 얻는 용도. 오프라인이거나 실패하면 null.
// player_live_api는 시작시각을 주지 않아, 폴링이 방송을 늦게 발견하면 그만큼 방송시간이
// 깎이던 문제(머리 손실)를 이 값으로 보정한다.
const STATION_API = `https://chapi.sooplive.co.kr/api/${BJ_ID}/station`;

export async function fetchSoopBroadStart(bno: string | null): Promise<string | null> {
  try {
    const res = await fetch(STATION_API, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      broad?: { broad_no?: number | string; broad_start?: string } | null;
    };
    const broad = json.broad;
    if (!broad?.broad_start) return null;
    // bno를 알면 같은 방송인지 확인한다(직전 방송의 시작시각을 새 방송에 붙이지 않게).
    if (bno !== null && broad.broad_no != null && String(broad.broad_no) !== bno) return null;
    // "YYYY-MM-DD HH:mm:ss" (KST) → ISO(UTC)
    const ms = Date.parse(`${broad.broad_start.replace(" ", "T")}+09:00`);
    if (!Number.isFinite(ms)) return null;
    const now = Date.now();
    // 미래값·하루 넘게 과거인 값은 이상치로 버린다(시계 오차·API 이변 방어).
    if (ms > now + 5 * 60 * 1000 || ms < now - 24 * 3600 * 1000) return null;
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

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
