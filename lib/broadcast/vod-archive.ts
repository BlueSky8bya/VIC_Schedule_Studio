import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { revalidatePublicSchedule } from "@/lib/schedules/cache";
import { BJ_ID } from "@/lib/broadcast/soop";

// 숲 다시보기(VOD) 아카이브 수집기(0068) — PLAN-20260831-001 Phase 1.
// chapi의 다시보기 목록을 읽어 vod_archive에 upsert한다. 비공식 API라 실패는 조용히
// 스킵하고 기존 데이터를 유지한다(fail-soft — station broad_start 소멸 전례).
//
// 호출처: 방송 백업 크론(broadcast-poll, 오프라인 30분마다 1페이지) + 초기 백필 스크립트
// (scripts/backfill-vod-archive.mjs — 같은 파싱 규칙을 복제, 여긴 런타임용).

const VOD_LIST_API = (page: number) =>
  `https://chapi.sooplive.co.kr/api/${BJ_ID}/vods/review?page=${page}&per_page=20&orderby=reg_date`;

export type VodArchiveRow = {
  titleNo: number;
  bno: string | null;
  broadcastDay: string; // YYYY-MM-DD (KST, 방송 시작일 귀속)
  title: string;
  durationMs: number;
  regDate: string | null; // ISO(UTC)
  commentCnt: number;
  likeCnt: number;
  readCnt: number;
};

// thumb rowKey: "YYYYMMDD_HEX_BNO_seq_r" — 날짜(방송 시작일 KST)와 bno가 박혀 있다.
// broadcast_session이 이미 이 rowKey의 bno로 세션↔VOD를 매칭한다(fetchSoopVodTimes).
export function parseThumbRowKey(thumb: unknown): { day: string; bno: string } | null {
  if (typeof thumb !== "string") return null;
  const m = /rowKey=(\d{4})(\d{2})(\d{2})_[0-9A-Fa-f]+_(\d+)_/.exec(thumb);
  if (!m) return null;
  return { day: `${m[1]}-${m[2]}-${m[3]}`, bno: m[4] };
}

// "YYYY-MM-DD HH:mm:ss"(KST) → ISO(UTC). 파싱 실패 시 null.
export function kstStringToIso(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 19) return null;
  const ms = Date.parse(`${value.replace(" ", "T")}+09:00`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

// 방송 시작일 귀속: rowKey 날짜 1순위(정답값), 없으면 등록시각(≈뱅종) − 길이의 KST 날짜.
export function attributeBroadcastDay(
  rowKeyDay: string | null,
  regDateIso: string | null,
  durationMs: number
): string | null {
  if (rowKeyDay) return rowKeyDay;
  if (!regDateIso) return null;
  const endMs = Date.parse(regDateIso);
  if (!Number.isFinite(endMs)) return null;
  const startMs = endMs - (Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0);
  // KST 날짜 문자열
  return new Date(startMs + 9 * 3600_000).toISOString().slice(0, 10);
}

type ApiItem = {
  title_no?: number;
  title_name?: string;
  reg_date?: string;
  ucc?: { thumb?: string; total_file_duration?: number | string };
  count?: { comment_cnt?: number; like_cnt?: number; read_cnt?: number };
};

export function mapApiItem(item: ApiItem): VodArchiveRow | null {
  const titleNo = Number(item.title_no);
  if (!Number.isFinite(titleNo) || titleNo <= 0) return null;
  const durationMs = Number(item.ucc?.total_file_duration);
  const dur = Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : 0;
  const rowKey = parseThumbRowKey(item.ucc?.thumb);
  const regIso = kstStringToIso(item.reg_date);
  const day = attributeBroadcastDay(rowKey?.day ?? null, regIso, dur);
  if (!day) return null; // 날짜 귀속이 안 되는 행은 버린다 — 날짜→VOD 매핑이 이 테이블의 존재 이유다.
  return {
    titleNo,
    bno: rowKey?.bno ?? null,
    broadcastDay: day,
    title: typeof item.title_name === "string" ? item.title_name : "",
    durationMs: dur,
    regDate: regIso,
    commentCnt: Number(item.count?.comment_cnt) || 0,
    likeCnt: Number(item.count?.like_cnt) || 0,
    readCnt: Number(item.count?.read_cnt) || 0
  };
}

export async function fetchVodListPage(page: number): Promise<VodArchiveRow[] | null> {
  try {
    const res = await fetch(VOD_LIST_API(page), {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: ApiItem[] };
    if (!Array.isArray(json.data)) return null;
    return json.data.map(mapApiItem).filter((r): r is VodArchiveRow => r !== null);
  } catch {
    return null;
  }
}

// 목록 1페이지(최신 20개)를 upsert — 뱅종 후 새로 올라온 VOD와 조회수 변화를 함께 흡수한다.
// 새 행이 실제로 생겼을 때만 공개 캐시를 무효화한다(조회수 갱신만으로 캐시를 흔들지 않는다).
export async function syncVodArchive(pages = 1): Promise<{ ok: boolean; upserted: number }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, upserted: 0 };
  let rows: VodArchiveRow[] = [];
  for (let p = 1; p <= pages; p += 1) {
    const pageRows = await fetchVodListPage(p);
    if (!pageRows) break; // 실패 페이지부터 중단 — 부분 성공분은 그대로 반영
    rows = rows.concat(pageRows);
    if (pageRows.length === 0) break;
  }
  if (rows.length === 0) return { ok: false, upserted: 0 };
  try {
    const known = await supabase
      .from("vod_archive")
      .select("title_no")
      .in("title_no", rows.map((r) => r.titleNo));
    const knownSet = new Set(((known.data as { title_no: number }[] | null) ?? []).map((r) => Number(r.title_no)));
    const { error } = await supabase.from("vod_archive").upsert(
      rows.map((r) => ({
        title_no: r.titleNo,
        bno: r.bno,
        broadcast_day: r.broadcastDay,
        title: r.title,
        duration_ms: r.durationMs,
        reg_date: r.regDate,
        comment_cnt: r.commentCnt,
        like_cnt: r.likeCnt,
        read_cnt: r.readCnt,
        synced_at: new Date().toISOString()
      })),
      { onConflict: "title_no" }
    );
    if (error) return { ok: false, upserted: 0 };
    const fresh = rows.filter((r) => !knownSet.has(r.titleNo)).length;
    if (fresh > 0) revalidatePublicSchedule();
    return { ok: true, upserted: rows.length };
  } catch {
    return { ok: false, upserted: 0 };
  }
}
