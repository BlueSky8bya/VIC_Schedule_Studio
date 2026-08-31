import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { BJ_ID } from "@/lib/broadcast/soop";
import { syncVodArchive, syncVodArchiveDeep } from "@/lib/broadcast/vod-archive";

// 팬 타임라인(다시보기 챕터) 수집·파싱(0071) — PLAN-20260831-001 Phase 2 A안.
// 숲 다시보기 댓글에서 타임라인 댓글(타임스탬프 3개 이상)을 골라 {sec, label, section}[]로
// 파싱한다. 비공식 API + 팬 창작 포맷이라 전부 fail-soft: 못 읽으면 그 VOD만 조용히 빈다.

export type TimelineEntry = {
  sec: number;
  label: string;
  section: string | null; // 팬이 적은 [코너] 헤더 — 예: "소통", "게임 - FC26"
};

// 숲 댓글 API는 본문을 HTML 이스케이프해서 준다("IT&#039;s Me") — 저장 전에 푼다.
// 이중 이스케이프도 실재해서(&amp;amp;, &amp;gt; — 2026-09-01 prod 실측) 안정될 때까지 반복,
// 상한 3회(팬이 진짜 "&amp;"를 쓰고 싶던 극단은 포기 — 표시 깨짐보다 낫다).
function decodeHtmlEntities(text: string): string {
  let out = text;
  for (let i = 0; i < 3; i += 1) {
    const next = out
      .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
    if (next === out) break;
    out = next;
  }
  return out;
}

// "1:02:03 라벨" / "02:15 라벨" 줄 → 초 + 라벨. 라벨 앞의 장식 기호(ㄴ, -, ·)는 남긴다 —
// 팬이 들여쓰기로 쓰는 대댓글식 계층이라 지우면 문맥이 사라진다.
const ENTRY_RE = /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(.+?)\s*$/;
// "[💬:소통]" / "[  게 임  ] - FC26" 같은 코너 헤더 줄.
const SECTION_RE = /^\s*\[\s*([^\]]+?)\s*\]\s*(?:[-–]\s*(.+?))?\s*$/;

// 코너 이름 정리: 이모지·콜론 접두 제거("💬:소통"→"소통"), 벌린 공백 접기("게 임"→"게임").
function cleanSection(inner: string, tail?: string): string {
  let name = inner.replace(/^[^가-힣A-Za-z0-9]*:?\s*/, "").replace(/\s*:\s*$/, "");
  name = name.replace(/([가-힣])\s+(?=[가-힣])/g, "$1");
  if (tail) name = `${name} - ${tail}`;
  return name.trim();
}

/** 타임라인 댓글 원문 → 챕터 배열(시각 오름차순 보장, 파싱 불가 줄은 건너뜀). */
export function parseTimeline(text: string): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  let section: string | null = null;
  for (const rawLine of decodeHtmlEntities(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const entry = ENTRY_RE.exec(line);
    if (entry) {
      const h = entry[3] !== undefined ? Number(entry[1]) : 0;
      const m = entry[3] !== undefined ? Number(entry[2]) : Number(entry[1]);
      const s = entry[3] !== undefined ? Number(entry[3]) : Number(entry[2]);
      const sec = h * 3600 + m * 60 + s;
      const label = entry[4].trim();
      if (label.length > 0 && Number.isFinite(sec)) out.push({ sec, label, section });
      continue;
    }
    const head = SECTION_RE.exec(line);
    if (head) {
      const name = cleanSection(head[1], head[2]);
      if (name.length > 0) section = name;
      continue;
    }
    // 그 외 장식 줄(✨타임라인✨ 등)은 무시.
  }
  out.sort((a, b) => a.sec - b.sec);
  return out;
}

type CommentItem = { p_comment_no?: number; user_nick?: string; comment?: string };

/** 댓글 목록에서 '가장 촘촘한' 타임라인 댓글을 고른다(타임스탬프 수 최대, 3개 미만은 무시). */
export function pickTimelineComment(
  comments: CommentItem[]
): { nick: string; commentNo: number | null; entries: TimelineEntry[] } | null {
  let best: { nick: string; commentNo: number | null; entries: TimelineEntry[] } | null = null;
  for (const c of comments) {
    if (typeof c.comment !== "string") continue;
    const entries = parseTimeline(c.comment);
    if (entries.length < 3) continue;
    if (!best || entries.length > best.entries.length) {
      best = {
        nick: typeof c.user_nick === "string" ? decodeHtmlEntities(c.user_nick) : "",
        commentNo: Number.isFinite(Number(c.p_comment_no)) ? Number(c.p_comment_no) : null,
        entries
      };
    }
  }
  return best;
}

async function fetchComments(titleNo: number): Promise<CommentItem[]> {
  const out: CommentItem[] = [];
  // 타임라인은 보통 1페이지에 있다 — 2페이지까지만 본다(댓글이 많은 VOD 대비).
  for (let page = 1; page <= 2; page += 1) {
    try {
      const res = await fetch(
        `https://chapi.sooplive.co.kr/api/${BJ_ID}/title/${titleNo}/comment?page=${page}&per_page=30`,
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) break;
      const json = (await res.json()) as { data?: CommentItem[]; meta?: { last_page?: number } };
      out.push(...(json.data ?? []));
      if (page >= (json.meta?.last_page ?? 1)) break;
    } catch {
      break;
    }
  }
  return out;
}

/**
 * 주어진 VOD들의 타임라인을 다시 수집해 vod_timeline에 upsert한다(없으면 빈 행 — "확인했음" 표시).
 * 증분 크론(broadcast-poll)과 백필이 같이 쓴다. 요청 사이 간격을 둔다(비공식 API 예의).
 */
export async function syncVodTimelines(titleNos: number[]): Promise<{ ok: boolean; saved: number }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase || titleNos.length === 0) return { ok: false, saved: 0 };
  let saved = 0;
  for (const titleNo of titleNos) {
    const comments = await fetchComments(titleNo);
    const best = pickTimelineComment(comments);
    const { error } = await supabase.from("vod_timeline").upsert(
      {
        title_no: titleNo,
        author_nick: best?.nick ?? "",
        comment_no: best?.commentNo ?? null,
        entry_count: best?.entries.length ?? 0,
        entries: best?.entries ?? [],
        synced_at: new Date().toISOString()
      },
      { onConflict: "title_no" }
    );
    if (!error) saved += 1;
    await new Promise((r) => setTimeout(r, 200));
  }
  return { ok: true, saved };
}

/**
 * VOD·타임라인 증분 동기화의 단일 진입점 — **호출 주기가 아니라 DB 스로틀**로 조절한다.
 * 백업 크론(1분)·시청자 폴링(soop-live) 어느 쪽이 불러도 같은 간격을 지킨다:
 *   뱅종 30분 안 = 1분 / 60분 안 = 5분 / 평시 = 30분 (2026-08-31 사용자 확정).
 * 근거를 서버 시계 분(min % N)이 아니라 '마지막 동기화 시각(vod_archive.synced_at)'으로 두는
 * 이유: 크론 호출 타이밍에 기대면 한 번 어긋날 때 통째로 굶는다(2026-09-01 prod 실측 —
 * 타임라인이 하루 종일 0건). 방송 중 호출 금지는 호출자가 보장한다.
 */
export async function maybeSyncVodPipeline(): Promise<{
  ran: boolean;
  tier: string;
  sinceEndMin: number | null;
}> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ran: false, tier: "no-admin", sinceEndMin: null };
  const sinceEnd = await minutesSinceLastBroadcastEnd();
  const tier =
    sinceEnd !== null && sinceEnd <= 30 ? "burst" : sinceEnd !== null && sinceEnd <= 60 ? "hot" : "calm";
  const intervalMin = tier === "burst" ? 1 : tier === "hot" ? 5 : 30;
  const { data } = await supabase
    .from("vod_archive")
    .select("synced_at")
    .order("synced_at", { ascending: false })
    .limit(1);
  const lastIso = (data as { synced_at: string }[] | null)?.[0]?.synced_at;
  const lastMs = lastIso ? Date.parse(lastIso) : 0;
  if (Number.isFinite(lastMs) && Date.now() - lastMs < intervalMin * 60_000) {
    return { ran: false, tier, sinceEndMin: sinceEnd };
  }
  // 평시엔 12시간에 한 번 **전체 카탈로그 스윕** — 한참 지난 VOD의 제목·썸네일 수정, 구독 전환,
  // 삭제까지 따라간다(가장 오래 안 본 행의 synced_at이 스윕 필요의 무상태 마커).
  let deep = false;
  if (tier === "calm") {
    const { data: oldest } = await supabase
      .from("vod_archive")
      .select("synced_at")
      .order("synced_at", { ascending: true })
      .limit(1);
    const oldestIso = (oldest as { synced_at: string }[] | null)?.[0]?.synced_at;
    deep = !oldestIso || Date.now() - Date.parse(oldestIso) > 12 * 3600_000;
  }
  if (deep) await syncVodArchiveDeep();
  else await syncVodArchive(1);
  // 타임라인: 평시엔 기간 제한 없이 오래 안 본 순으로 순환(8개/30분 → 전체 ~20시간 주기) —
  // 옛 타임라인의 나중 수정도 하루 안에 흡수된다. 뱅종 직후엔 최신만 빠르게.
  const [limit, days] = tier === "burst" ? [1, 1] : tier === "hot" ? [3, 2] : [8, 3650];
  await syncVodTimelines(await pickTimelineSyncTargets(limit, days));
  return { ran: true, tier, sinceEndMin: sinceEnd };
}

/** 마지막 뱅종 후 지난 분(分). 세션 기록이 없으면 null. 뱅종 직후 고속 수집 창 판정용. */
export async function minutesSinceLastBroadcastEnd(): Promise<number | null> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;
  const { data } = await supabase
    .from("broadcast_session")
    .select("ended_at")
    .not("ended_at", "is", null)
    .order("ended_at", { ascending: false })
    .limit(1);
  const iso = (data as { ended_at: string }[] | null)?.[0]?.ended_at;
  if (!iso) return null;
  const diff = (Date.now() - Date.parse(iso)) / 60_000;
  return Number.isFinite(diff) ? diff : null;
}

/**
 * 증분 대상 고르기: 최근 N일 안에 등록된 VOD(팬 타임라인이 며칠에 걸쳐 갱신된다) 중
 * 아직 한 번도 안 본 것 우선, 그다음 오래 전에 본 것 순으로 최대 limit개.
 */
export async function pickTimelineSyncTargets(limit = 8, days = 14): Promise<number[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];
  const sinceIso = new Date(Date.now() - days * 86400_000).toISOString();
  const [vodsRes, tlRes] = await Promise.all([
    // days가 크면(평시 전체 순환) 사실상 전 카탈로그가 후보 — 500이면 수년치 여유.
    supabase
      .from("vod_archive")
      .select("title_no, reg_date")
      .gte("reg_date", sinceIso)
      .order("reg_date", { ascending: false })
      .limit(500),
    supabase.from("vod_timeline").select("title_no, synced_at")
  ]);
  const synced = new Map(
    (((tlRes.data as { title_no: number; synced_at: string }[] | null) ?? [])).map((r) => [
      Number(r.title_no),
      Date.parse(r.synced_at)
    ])
  );
  const vods = ((vodsRes.data as { title_no: number }[] | null) ?? []).map((r) => Number(r.title_no));
  const fresh = vods.filter((no) => !synced.has(no));
  const stale = vods
    .filter((no) => synced.has(no))
    .sort((a, b) => (synced.get(a) ?? 0) - (synced.get(b) ?? 0));
  return [...fresh, ...stale].slice(0, limit);
}
