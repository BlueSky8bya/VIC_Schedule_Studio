import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { revalidatePublicSchedule } from "@/lib/schedules/cache";
import { BJ_ID } from "@/lib/broadcast/soop";
import { kstStringToIso, VOD_DAY_CUTOFF_HOURS } from "./vod-archive";
import { createWorkBudget, singleFlight, type WorkBudget } from "./work-budget";

// 구독 전용 업로드 영상 수집기(0155→0156, 2026-10-23 소유자) — 숲 카드의 '구독' 배지(업로드 + auth_no 107).
// vod_archive에 upload=true 행으로 쓴다(0156: 검색·팬 타임라인이 같은 말뭉치를 읽도록. 방송 통계·스윕·채팅 큐는
// upload 행을 뺀다 — guest 행과 같은 자리). 목록 API는 다시보기·업로드·클립을 한데 주므로 NORMAL + 107만 고른다.
// 비공식 API라 실패는 조용히 스킵(기존 행 유지, fail-soft).
// 호출처: runVodPipeline(평시 1페이지, 12시간 스윕 때 전 페이지 + 사라진 행 정리).

const PER_PAGE = 60;
const LIST_API = (page: number) =>
  `https://chapi.sooplive.co.kr/api/${BJ_ID}/vods/normal?page=${page}&per_page=${PER_PAGE}&orderby=reg_date`;
export const SUBSCRIPTION_AUTH_NO = 107;

export type VodUploadRow = {
  titleNo: number;
  uploadDay: string;
  title: string;
  durationMs: number;
  thumb: string;
  regDate: string | null;
  authNo: number;
};

type ApiItem = {
  title_no?: number;
  title_name?: string;
  reg_date?: string;
  auth_no?: number | string;
  ucc?: { thumb?: string; total_file_duration?: number | string; file_type?: string };
};

const kstDayOf = (ms: number): string => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);

/**
 * 귀속일: 제목에 'M월 D일'이 있으면 그 날(업로드는 방송 뒤라 등록 연도, 등록 달보다 크면 전년도 —
 * "[비방] 12월 18일" 이 12/19에 올라온 실례). 없으면 등록 시각에 다시보기와 같은 새벽 6시 경계.
 */
export function attributeUploadDay(title: string, regIso: string | null): string | null {
  const regMs = regIso !== null ? Date.parse(regIso) : Number.NaN;
  if (!Number.isFinite(regMs)) return null;
  const regDay = kstDayOf(regMs);
  const m = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(title);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const regYear = Number(regDay.slice(0, 4));
      const regMonth = Number(regDay.slice(5, 7));
      const year = month > regMonth ? regYear - 1 : regYear;
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      // 달력에 없는 날(2월 30일 등)은 버리고 등록 시각으로.
      if (new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso) return iso;
    }
  }
  return kstDayOf(regMs - VOD_DAY_CUTOFF_HOURS * 3600_000);
}

/** 구독 전용 업로드만 행으로. 다른 종류는 null(무시 대상), 형식이 깨진 업로드는 "bad". */
export function mapUploadItem(item: ApiItem): VodUploadRow | null | "bad" {
  if (item.ucc?.file_type !== "NORMAL" || Number(item.auth_no) !== SUBSCRIPTION_AUTH_NO) return null;
  const titleNo = Number(item.title_no);
  if (!Number.isSafeInteger(titleNo) || titleNo <= 0) return "bad";
  const title = typeof item.title_name === "string" ? item.title_name : "";
  const regDate = kstStringToIso(item.reg_date);
  const uploadDay = attributeUploadDay(title, regDate);
  if (!uploadDay) return "bad";
  const dur = Number(item.ucc?.total_file_duration);
  return {
    titleNo,
    uploadDay,
    title,
    durationMs: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 0,
    thumb: typeof item.ucc?.thumb === "string" ? item.ucc.thumb : "",
    regDate,
    authNo: SUBSCRIPTION_AUTH_NO
  };
}

async function fetchUploadPage(page: number, budget: WorkBudget): Promise<{ rows: VodUploadRow[]; lastPage: number; size: number } | null> {
  try {
    const res = await fetch(LIST_API(page), {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: budget.signal(8000, 5000)
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: ApiItem[]; meta?: { last_page?: number } };
    const lastPage = Number(json.meta?.last_page);
    if (!Array.isArray(json.data) || !Number.isSafeInteger(lastPage) || lastPage < 1 || lastPage > 100) return null;
    const mapped = json.data.map(mapUploadItem);
    // 깨진 항목 하나가 '삭제됨'의 증거가 되면 안 된다 — 페이지 전체를 실패로.
    if (mapped.includes("bad")) return null;
    return { rows: mapped.filter((r): r is VodUploadRow => r !== null && r !== "bad"), lastPage, size: json.data.length };
  } catch {
    return null;
  }
}

/**
 * full=false: 최신 1페이지만 upsert(새 업로드 흡수). full=true: 전 페이지를 읽어 **완전할 때만**
 * 목록에서 사라진(삭제·공개 전환) 행을 지운다 — 불완전 스캔은 upsert만(fail-safe).
 */
async function runUploadSync(full: boolean, budget = createWorkBudget(20_000)): Promise<{ ok: boolean; upserted: number; deleted: number }> {
  const db = createSupabaseAdminClient();
  const failed = { ok: false, upserted: 0, deleted: 0 };
  if (!db || budget.remaining(6000) <= 0) return failed;
  const rows = new Map<number, VodUploadRow>();
  let complete = false;
  let lastPage = 1;
  for (let page = 1; page <= (full ? lastPage : 1); page++) {
    if (budget.remaining(6000) <= 0) break;
    const res = await fetchUploadPage(page, budget);
    if (!res) break;
    if (page > 1 && res.lastPage !== lastPage) break; // 넘기는 사이 목록이 바뀌었다 — 불완전 취급
    lastPage = res.lastPage;
    for (const r of res.rows) rows.set(r.titleNo, r);
    if (page === lastPage || res.size === 0) complete = full;
  }
  try {
    const known = await db.from("vod_archive").select("title_no").eq("upload", true).abortSignal(budget.signal(5000));
    if (known.error) return failed;
    const knownIds = new Set(((known.data as { title_no: number }[] | null) ?? []).map((r) => Number(r.title_no)));
    if (rows.size > 0) {
      const now = new Date().toISOString();
      const { error } = await db.from("vod_archive").upsert(
        [...rows.values()].map((r) => ({
          title_no: r.titleNo, broadcast_day: r.uploadDay, title: r.title, duration_ms: r.durationMs,
          thumb: r.thumb, reg_date: r.regDate, auth_no: r.authNo, upload: true, guest: false, synced_at: now
        })),
        { onConflict: "title_no" }
      ).abortSignal(budget.signal(5000));
      if (error) return failed;
    }
    // 오인 삭제 방지: 완전 스캔 + 남는 행이 있을 때 + 소량(5건 이하)만.
    const gone = complete && rows.size > 0 ? [...knownIds].filter((id) => !rows.has(id)) : [];
    let deleted = 0;
    if (gone.length > 0 && gone.length <= 5) {
      const { error } = await db.from("vod_archive").delete().eq("upload", true).in("title_no", gone).abortSignal(budget.signal(5000));
      if (!error) deleted = gone.length;
    }
    const fresh = [...rows.keys()].some((id) => !knownIds.has(id));
    if (fresh || deleted > 0) revalidatePublicSchedule();
    return { ok: true, upserted: rows.size, deleted };
  } catch {
    return failed;
  }
}

export const syncVodUploads = singleFlight(runUploadSync);
