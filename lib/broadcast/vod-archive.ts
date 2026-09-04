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
  // SOOP 시청 권한(0069). 101=전체 공개, 107=구독(플러스) 전용 — 공개 칩은 101만 내보낸다.
  authNo: number;
  // 대표 썸네일 URL(0072) — 날짜 다시보기 창의 미리보기.
  thumb: string;
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

// 방송일 경계 = 새벽 6시(KST) — 자정이 아니다(2026-08-31 사용자 결정, '다시보기 가중치').
// 00:03에 켠 별별랭킹은 달력상 1/6이지만 사람 감각·편집실 일정으론 **1/5 밤 방송**이다
// (실측: 1/6은 휴뱅인데 새벽 방송 2개가 붙어 일정과 어긋났다). 6시 이전 시작은 전날로 귀속.
export const VOD_DAY_CUTOFF_HOURS = 6;

const kstDayOf = (ms: number): string => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);

// 방송 시작일 귀속 우선순위:
//  1) rowKey 날짜가 실측 시작 날짜와 '다르면' rowKey를 믿는다 — SOOP이 이미 세션 기준으로
//     보정해 준 값이거나(실측: 8/25 01:17 시작 VOD의 rowKey가 8/24), 등록 지연으로 우리
//     계산이 틀린 경우다.
//  2) rowKey가 달력상 시작 날짜 그대로인데 시작이 새벽(6시 이전)이면 전날로 내린다(위 경계).
//  3) rowKey가 없으면 실측 시작에 6시 경계를 적용한 날짜.
export function attributeBroadcastDay(
  rowKeyDay: string | null,
  regDateIso: string | null,
  durationMs: number
): string | null {
  const endMs = regDateIso !== null ? Date.parse(regDateIso) : Number.NaN;
  if (!Number.isFinite(endMs)) return rowKeyDay;
  const startMs = endMs - (Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0);
  const literalDay = kstDayOf(startMs);
  const dawnDay = kstDayOf(startMs - VOD_DAY_CUTOFF_HOURS * 3600_000);
  if (rowKeyDay) {
    if (rowKeyDay === literalDay && literalDay !== dawnDay) return dawnDay;
    return rowKeyDay;
  }
  return dawnDay;
}

type ApiItem = {
  title_no?: number;
  title_name?: string;
  reg_date?: string;
  auth_no?: number | string;
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
    readCnt: Number(item.count?.read_cnt) || 0,
    // 값이 없거나 이상하면 0(=미상) — 101(공개)로 지어내지 않는다: 공개 칩은 101만 나가므로
    // 미상은 자동으로 숨는 쪽(fail-closed)이다.
    authNo: Number.isFinite(Number(item.auth_no)) ? Number(item.auth_no) : 0,
    thumb: typeof item.ucc?.thumb === "string" ? item.ucc.thumb : ""
  };
}

// 방송이 터져 자정 넘어 재시작하면(새 bno) VOD가 갈라져 재시작분이 '다음날'로 귀속된다 —
// 사람 감각으론 같은 밤 방송이다(실사례: 04-13 밤 방송 → 04-14 00시 "방송터짐!!!" + 재시작).
// 그래서 **직전 VOD 종료와 간격이 30분 이내면 같은 방송으로 보고 앞 방송의 날짜를 잇는다**
// (2026-08-31 사용자 결정). 날짜가 같아지면 시청자 카드엔 '다시보기 1·2'로 함께 붙는다.
export const VOD_CHAIN_GAP_MS = 30 * 60_000;

const vodStartMs = (r: VodArchiveRow): number | null =>
  r.regDate === null ? null : Date.parse(r.regDate) - r.durationMs;

/**
 * 시작시각 오름차순으로 훑으며 30분 이내로 이어지는 VOD에 앞 방송의 broadcastDay를 전파한다
 * (제자리 갱신, 반환 = 바뀐 행 수). 체인은 이행적이다: 터짐→재시작→재재시작이 전부 첫 방송 날.
 * regDate가 없는 행은 체인을 끊는다(간격을 잴 수 없으면 잇지 않는다 — 보수적).
 */
export function chainBroadcastDays(rows: VodArchiveRow[]): number {
  const sorted = rows
    .filter((r) => r.regDate !== null)
    .sort((a, b) => (vodStartMs(a) ?? 0) - (vodStartMs(b) ?? 0));
  let changed = 0;
  let prevEnd: number | null = null;
  let chainDay: string | null = null;
  for (const r of sorted) {
    const start = vodStartMs(r)!;
    const end = Date.parse(r.regDate!);
    // 겹침(음수 간격)도 같은 방송이다 — 길이 반올림·등록 지연으로 생긴다.
    if (prevEnd !== null && chainDay !== null && start - prevEnd <= VOD_CHAIN_GAP_MS) {
      if (r.broadcastDay !== chainDay) {
        r.broadcastDay = chainDay;
        changed += 1;
      }
    } else {
      chainDay = r.broadcastDay;
    }
    prevEnd = Math.max(prevEnd ?? Number.NEGATIVE_INFINITY, end);
  }
  return changed;
}

// 날짜 귀속 명시적 예외 — scripts/backfill-vod-archive.mjs의 DAY_OVERRIDES와 같은 목록(2026-08-31).
// 전체 스윕(아래 syncVodArchiveDeep)이 옛 행을 다시 쓰므로 여기에도 없으면 예외가 풀려버린다.
const DAY_OVERRIDES = new Map<number, string>([
  [154012373, "2025-03-13"], // [WBD] 야구 연습 2일차 -1 (새벽 시작 — 13일 세션)
  [154108485, "2025-03-14"], // [WBD] 야구 연습 3일차
  [137094755, "2024-09-23"], // [버축대2] FC25 연습 3일차
  [137222735, "2024-09-24"], // [버축대2] FC25 연습 4일차 -1
  [137281079, "2024-09-24"] // [버축대2] FC25 연습 4일차 -2
]);
function applyDayOverrides(rows: VodArchiveRow[]): void {
  for (const r of rows) {
    const o = DAY_OVERRIDES.get(r.titleNo);
    if (o) r.broadcastDay = o;
  }
}

export async function fetchVodListPage(
  page: number
): Promise<{ rows: VodArchiveRow[]; lastPage: number } | null> {
  try {
    const res = await fetch(VOD_LIST_API(page), {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: ApiItem[]; meta?: { last_page?: number } };
    if (!Array.isArray(json.data)) return null;
    return {
      rows: json.data.map(mapApiItem).filter((r): r is VodArchiveRow => r !== null),
      lastPage: Number(json.meta?.last_page) || page
    };
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
    const page = await fetchVodListPage(p);
    if (!page) break; // 실패 페이지부터 중단 — 부분 성공분은 그대로 반영
    rows = rows.concat(page.rows);
    if (page.rows.length === 0) break;
  }
  if (rows.length === 0) return { ok: false, upserted: 0 };
  try {
    const known = await supabase
      .from("vod_archive")
      .select("title_no")
      .in("title_no", rows.map((r) => r.titleNo));
    const knownSet = new Set(((known.data as { title_no: number }[] | null) ?? []).map((r) => Number(r.title_no)));
    // 30분 체인은 '직전 방송'을 알아야 한다. 새로 받은 묶음에 직전 방송이 없을 수 있으므로
    // (증분 1페이지 경계), 저장돼 있는 최근 행을 합쳐서 함께 체인한다. 저장 행도 다시 upsert
    // 된다 — 같은 알고리즘이라 결과는 멱등이고, 경계에서 어긋난 날짜가 있으면 이때 교정된다.
    // 게스트 출연분(0075, 다른 채널)은 체인·재upsert 대상이 아니다.
    const recent = await supabase
      .from("vod_archive")
      .select("title_no, bno, broadcast_day, title, duration_ms, reg_date, comment_cnt, like_cnt, read_cnt, auth_no, thumb")
      .eq("guest", false)
      .order("reg_date", { ascending: false, nullsFirst: false })
      .limit(40);
    const fetchedIds = new Set(rows.map((r) => r.titleNo));
    type StoredRow = {
      title_no: number; bno: string | null; broadcast_day: string; title: string;
      duration_ms: number; reg_date: string | null; comment_cnt: number; like_cnt: number;
      read_cnt: number; auth_no: number; thumb: string;
    };
    for (const s of ((recent.data as StoredRow[] | null) ?? [])) {
      if (fetchedIds.has(Number(s.title_no))) continue;
      rows.push({
        titleNo: Number(s.title_no),
        bno: s.bno,
        broadcastDay: String(s.broadcast_day).slice(0, 10),
        title: s.title,
        durationMs: Number(s.duration_ms) || 0,
        regDate: s.reg_date,
        commentCnt: Number(s.comment_cnt) || 0,
        likeCnt: Number(s.like_cnt) || 0,
        readCnt: Number(s.read_cnt) || 0,
        authNo: Number(s.auth_no) || 0,
        thumb: typeof s.thumb === "string" ? s.thumb : ""
      });
    }
    chainBroadcastDays(rows);
    applyDayOverrides(rows);
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
        auth_no: r.authNo,
        thumb: r.thumb,
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

/**
 * 전체 카탈로그 스윕(12시간 주기, maybeSyncVodPipeline이 부른다) — 토리님이 **한참 지난 VOD**의
 * 제목·썸네일·공개범위를 나중에 고쳐도 사이트가 따라가게 전 페이지를 다시 읽는다.
 * 삭제 반영 포함: 목록에서 사라진 VOD는 우리 행도 지운다(죽은 다시보기 링크 방지). 단
 * **전량 수집이 완전할 때만 + 소량일 때만**(비공식 API 이변으로 목록이 텅 비면 오인 삭제 —
 * fail-safe). 요청 ~20회/12시간이라 부담 없음.
 */
export async function syncVodArchiveDeep(): Promise<{ ok: boolean; total: number; deleted: number }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, total: 0, deleted: 0 };
  const all: VodArchiveRow[] = [];
  let page = 1;
  let lastPage = 1;
  let complete = true;
  for (;;) {
    const res = await fetchVodListPage(page);
    if (!res) {
      complete = false;
      break;
    }
    all.push(...res.rows);
    lastPage = Math.max(lastPage, res.lastPage);
    if (page >= lastPage || res.rows.length === 0) break;
    page += 1;
    await new Promise((r) => setTimeout(r, 200));
  }
  if (all.length === 0) return { ok: false, total: 0, deleted: 0 };
  chainBroadcastDays(all);
  applyDayOverrides(all);
  try {
    for (let i = 0; i < all.length; i += 200) {
      const { error } = await supabase.from("vod_archive").upsert(
        all.slice(i, i + 200).map((r) => ({
          title_no: r.titleNo,
          bno: r.bno,
          broadcast_day: r.broadcastDay,
          title: r.title,
          duration_ms: r.durationMs,
          reg_date: r.regDate,
          comment_cnt: r.commentCnt,
          like_cnt: r.likeCnt,
          read_cnt: r.readCnt,
          auth_no: r.authNo,
          thumb: r.thumb,
          synced_at: new Date().toISOString()
        })),
        { onConflict: "title_no" }
      );
      if (error) return { ok: false, total: all.length, deleted: 0 };
    }
    let deleted = 0;
    if (complete) {
      const ids = new Set(all.map((r) => r.titleNo));
      // 게스트 출연분(0075)은 토리님 목록에 없는 게 당연 — 삭제 동기화에서 뺀다.
      const dbRows = await supabase.from("vod_archive").select("title_no").eq("guest", false);
      const gone = (((dbRows.data as { title_no: number }[] | null) ?? []))
        .map((r) => Number(r.title_no))
        .filter((no) => !ids.has(no));
      if (gone.length > 0 && gone.length <= 20) {
        await supabase.from("vod_archive").delete().in("title_no", gone);
        await supabase.from("vod_timeline").delete().in("title_no", gone);
        deleted = gone.length;
      }
    }
    // 제목·썸네일·범위·삭제가 공개 화면에 바로 반영되게 캐시 무효화.
    revalidatePublicSchedule();
    return { ok: true, total: all.length, deleted };
  } catch {
    return { ok: false, total: all.length, deleted: 0 };
  }
}
