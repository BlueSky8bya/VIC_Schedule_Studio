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
  // 라이브일 때 '실제 방송 시작 시각'(ISO). player_live_api의 BTIME(경과 초)에서 계산한다 —
  // 폴링이 늦어도 시작시각은 정확하다. 오프라인이거나 값이 이상하면 null.
  startedAt: string | null;
};

export const offlineState = (): LiveState => ({
  isLive: false,
  bjId: BJ_ID,
  bjNick: null,
  title: null,
  category: null,
  bno: null,
  watchUrl: null,
  startedAt: null
});

// BTIME(방송 경과 초) → 시작 ISO. 0 이하·48시간 초과는 이상치로 버린다(파싱 실패·API 이변 방어).
export function startedAtFromBtime(btime: unknown, nowMs: number): string | null {
  const sec = Number(btime);
  if (!Number.isFinite(sec) || sec <= 0 || sec > 48 * 3600) return null;
  return new Date(nowMs - sec * 1000).toISOString();
}

// 실제 방송 시작 시각의 '2차 출처'. 1차는 player_live_api의 BTIME(경과 초)이고, 그게 없을 때만
// 이걸 쓴다. 예전엔 방송국 API(chapi .../station)의 broad.broad_start를 읽었는데, SOOP가 그 필드를
// 응답에서 빼버려(2026-08 확인) 항상 null → 시작시각이 '첫 폴링 시각'으로 굳고 방송시간의 머리가
// 통째로 깎였다(오늘 32분 손실). 라이브 검색 API는 여전히 broad_start(KST 문자열)를 준다.
const SEARCH_API =
  `https://sch.sooplive.co.kr/api.php?m=liveSearch&v=1.0&szOrder=&szKeyword=${BJ_ID}` +
  `&nPageNo=1&nListCnt=10&szPlatform=pc`;

export async function fetchSoopBroadStart(bno: string | null): Promise<string | null> {
  try {
    const res = await fetch(SEARCH_API, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      REAL_BROAD?: { user_id?: string; broad_no?: string | number; broad_start?: string }[];
    };
    const list = json.REAL_BROAD ?? [];
    // bno를 알면 그 방송을, 모르면 우리 BJ의 방송을 고른다(검색 결과에 동명 방송이 섞일 수 있다).
    const item =
      bno !== null
        ? list.find((v) => v.broad_no != null && String(v.broad_no) === bno)
        : list.find((v) => v.user_id === BJ_ID);
    if (!item?.broad_start) return null;
    // "YYYY-MM-DD HH:mm:ss" (KST) → ISO(UTC)
    const ms = Date.parse(`${item.broad_start.replace(" ", "T")}+09:00`);
    if (!Number.isFinite(ms)) return null;
    const now = Date.now();
    // 미래값·하루 넘게 과거인 값은 이상치로 버린다(시계 오차·API 이변 방어).
    if (ms > now + 5 * 60 * 1000 || ms < now - 24 * 3600 * 1000) return null;
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

// 다시보기(VOD) API — 방송이 끝나면 몇 분 안에 자동 등록된다. reg_date(등록시각) ≈ 실제
// 뱅종 시각, total_file_duration(ms) = 실제 방송 길이, 썸네일 rowKey에 bno가 박혀 있어
// 어느 방송의 VOD인지 정확히 맞출 수 있다. 뱅종 감지 시 ended_at 꼬리 손실(마지막 폴링
// 이후 구간이 통째로 깎이던 문제)을 이 값으로 보정한다. 실패/미등록이면 null(보수적 폴백).
const VOD_API = `https://chapi.sooplive.co.kr/api/${BJ_ID}/vods/review?page=1&per_page=20&orderby=reg_date`;

export type VodTimes = { startedAt: string; endedAt: string };

export async function fetchSoopVodTimes(bno: string): Promise<VodTimes | null> {
  try {
    const res = await fetch(VOD_API, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: { reg_date?: string; ucc?: { thumb?: string; total_file_duration?: number } }[];
    };
    const item = (json.data ?? []).find((v) => v.ucc?.thumb?.includes(`_${bno}_`));
    if (!item?.reg_date) return null;
    const durMs = Number(item.ucc?.total_file_duration);
    // "YYYY-MM-DD HH:mm:ss" (KST) → ISO(UTC)
    const endMs = Date.parse(`${item.reg_date.replace(" ", "T")}+09:00`);
    if (!Number.isFinite(endMs) || !Number.isFinite(durMs)) return null;
    // 이상치 가드: 길이 1분~24h, 등록시각이 미래이거나 이틀 넘게 과거면 버린다.
    const now = Date.now();
    if (durMs < 60 * 1000 || durMs > 24 * 3600 * 1000) return null;
    if (endMs > now + 10 * 60 * 1000 || endMs < now - 48 * 3600 * 1000) return null;
    return {
      startedAt: new Date(endMs - durMs).toISOString(),
      endedAt: new Date(endMs).toISOString()
    };
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
        : `https://www.sooplive.com/station/${BJ_ID}`,
      // BTIME = 방송 경과 초. 같은 응답 안에 있어 추가 요청 없이 '진짜 시작 시각'을 얻는다.
      startedAt: startedAtFromBtime(c.BTIME, Date.now())
    };
  } catch {
    return offlineState();
  }
}
