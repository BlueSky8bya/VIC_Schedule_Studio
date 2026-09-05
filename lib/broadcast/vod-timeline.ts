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
  // 팬이 "ㄴ"으로 표시한 계층 — 0(최상위)이면 아예 안 담는다(항목 100+개 × jsonb 절약).
  depth?: number;
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

// 항목 줄 → 초 + 라벨 + 계층. 팬마다 표기 습관이 다르다 — **2026-09-06 VOD 385편 댓글 전수조사**로
// 아래 표기를 모두 받도록 넓혔다(그전엔 첫 줄 형태만 읽어 나머지는 통째로 버려졌다):
//   "1:02:03 라벨" · "02:15 라벨"            ← 원래 지원
//   "[ 02:10:55 ] 라벨" · "(02:10) 라벨"      ← 괄호로 감싼 시각(이 표기의 댓글은 항목 0개로 전멸)
//   "ㄴ[ 02:13:59 ] 세부" · "00:15:00 ㄴ 세부" ← 계층 표시(앞·뒤 양쪽 습관)
//   "01:18:00토리님 복귀"                     ← 시각과 라벨이 붙은 표기
//   "02:29:49:✨:라벨"                        ← 시각 뒤 구분 콜론
//   "00:7:30 귤 노가리"                       ← 분·초 한 자리 오타
//   "발로란트 01:23:25" · "[🌺무꽃피] 54:30"  ← 라벨이 앞, 시각이 뒤(여러 시각이면 항목 여러 개)
// 일부러 **안** 받는 것: 라벨 없는 시각 나열("4:40:04*" 76줄 — 클립 표시라 목록에 쓸 게 없다),
// 날짜 표기("[ 26.06.02 ]"), 다른 방송을 가리키는 긴 문장(라벨 32자 상한 밖).
// "ㄴ"(└ >)는 "바로 위 항목에 딸린 세부"라는 팬들의 관습 — 라벨에 묻어두지 않고 depth로 뽑아
// UI가 들여쓰기로 보여준다. 순수 불릿(- · •)은 벗기기만 하고 계층으로 세지 않는다(뒤에 공백을
// 요구해서 "-20도" 같은 라벨을 갉아먹지 않는다).
const LEAD_RE = /^\s*((?:[ㄴ└>▸▹»]\s*|[-–—·•‣]\s+)+)/;
const HIER_RE = /[ㄴ└>▸▹»]/g;
// 분·초가 한 자리인 오타도 받는다("00:7:30" — 실측 1건). 대신 값 범위를 검사한다.
const TIME_RE = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/;
// 라벨 자격: 글자/숫자가 하나는 있어야 한다. "4:40:04*"처럼 기호만 남는 줄(클립 표시 76개, 실측)이
// 항목으로 둔갑하는 걸 막는다.
const WORDISH = /[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ぀-ヿ一-鿿]/;
// 시각에 바로 붙는 시간 표현("12:34분에 시작함") — 항목이 아니라 본문이다.
const TIME_WORD = /^(분|초|시|쯤|경|부터|까지|께)/;
// 라벨이 먼저, 시각이 뒤인 표기("발로란트 01:23:25", "[🌺무꽃피] 54:30", "롤 23:05 01:45:20").
// 라벨 32자 상한이 본문 문장을 걸러낸다(실측: 이 규칙이 잡는 10줄 전부 진짜 항목, 남는 탈락은
// 다른 스트리머 다시보기를 가리키는 38자 문장 하나 — 그건 이 플레이어로 못 뛰니 빼는 게 맞다).
const TRAIL_RE = /^(.{1,32}?)\s+((?:\d{1,2}:\d{1,2}(?::\d{1,2})?[\s*]*)+)$/;
const TIME_TOKEN_RE = /\d{1,2}:\d{1,2}(?::\d{1,2})?/g;
const MAX_DEPTH = 3;
// "[💬:소통]" / "[  게 임  ] - FC26" 같은 코너 헤더 줄.
const SECTION_RE = /^\s*\[\s*([^\]]+?)\s*\]\s*(?:[-–]\s*(.+?))?\s*$/;

/** 줄머리(또는 시각 뒤)의 계층·불릿 표시를 벗기고 계층 깊이를 센다. */
function stripLead(text: string): { rest: string; depth: number } {
  const m = LEAD_RE.exec(text);
  if (!m) return { rest: text.trimStart(), depth: 0 };
  return { rest: text.slice(m[0].length), depth: (m[1].match(HIER_RE) ?? []).length };
}

/** "1:02:03"/"02:15" 토큰 → 초. 분·초가 60을 넘으면 시각이 아니다(널). */
function toSeconds(hh: string, mm: string, ss?: string): number | null {
  const h = ss !== undefined ? Number(hh) : 0;
  const m = ss !== undefined ? Number(mm) : Number(hh);
  const s = ss !== undefined ? Number(ss) : Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s)) return null;
  if (s > 59) return null;
  if (ss !== undefined && m > 59) return null; // "MM:SS"의 분은 60을 넘어도 된다("90:12")
  return h * 3600 + m * 60 + s;
}

/** 항목 줄 하나 → 엔트리(항목이 아니면 null — 호출자가 코너 헤더/장식 줄로 넘긴다). */
function parseEntryLine(line: string): TimelineEntry | null {
  const lead = stripLead(line);
  let rest = lead.rest;
  let depth = lead.depth;
  const close = rest[0] === "[" ? "]" : rest[0] === "(" ? ")" : "";
  if (close) rest = rest.slice(1).trimStart();
  const t = TIME_RE.exec(rest);
  if (!t) return null;
  rest = rest.slice(t[0].length);
  if (close) {
    const after = rest.replace(/^\s*/, "");
    if (after[0] !== close) return null; // 여는 괄호만 있으면 항목이 아니다
    rest = after.slice(1);
  } else if (TIME_WORD.test(rest)) {
    return null; // "12:34분에 시작함" 같은 본문 속 시각
  }
  // 시각 바로 뒤의 구분 콜론("02:29:49:✨:라벨")은 라벨이 아니라 이음새다.
  rest = rest.replace(/^[:：]+\s*/, "");
  const tail = stripLead(rest); // 시각 뒤에 붙는 계층 표시("00:15:00 ㄴ 세부")도 같은 뜻
  const label = tail.rest.trim();
  if (!WORDISH.test(label)) return null; // 빈 줄·기호만 남은 클립 표시
  depth = Math.min(depth + tail.depth, MAX_DEPTH);
  const sec = toSeconds(t[1], t[2], t[3]);
  if (sec === null) return null;
  return depth > 0 ? { sec, label, section: null, depth } : { sec, label, section: null };
}

/** "라벨 시각[ 시각…]" 줄 → 같은 라벨의 엔트리들(아니면 빈 배열). */
function parseTrailingTimeLine(line: string): TimelineEntry[] {
  const m = TRAIL_RE.exec(line);
  if (!m) return [];
  const lead = stripLead(m[1]);
  const head = lead.rest.trim();
  // "[🌺무꽃피]"처럼 통째로 대괄호면 코너 이름 정리를 그대로 쓴다.
  const bracket = /^\[\s*([^\]]+?)\s*\]$/.exec(head);
  const label = bracket ? cleanSection(bracket[1]) : head;
  if (!WORDISH.test(label)) return [];
  const out: TimelineEntry[] = [];
  for (const token of m[2].match(TIME_TOKEN_RE) ?? []) {
    const p = token.split(":");
    const sec = toSeconds(p[0], p[1], p[2]);
    if (sec === null) continue;
    const depth = Math.min(lead.depth, MAX_DEPTH);
    out.push(depth > 0 ? { sec, label, section: null, depth } : { sec, label, section: null });
  }
  return out;
}

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
    const entry = parseEntryLine(line);
    if (entry) {
      entry.section = section;
      out.push(entry);
      continue;
    }
    const head = SECTION_RE.exec(line);
    if (head) {
      // "[ 02:10:55 ]"처럼 라벨 없는 시각 줄이 코너 이름 "02:10:55"로 둔갑하지 않게 막는다.
      if (TIME_RE.test(head[1].trim())) continue;
      const name = cleanSection(head[1], head[2]);
      if (name.length > 0) section = name;
      continue;
    }
    // 라벨이 앞, 시각이 뒤인 표기는 마지막에 본다(앞선 규칙이 다 아니라고 한 줄에서만).
    const trailing = parseTrailingTimeLine(line);
    if (trailing.length > 0) {
      for (const e of trailing) {
        e.section = section;
        out.push(e);
      }
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

// hostId = 댓글이 달린 채널 — 토리님 본방은 BJ_ID, 합방 게스트 출연분(0075)은 호스트 스트리머 id.
async function fetchComments(titleNo: number, hostId: string = BJ_ID): Promise<CommentItem[]> {
  const out: CommentItem[] = [];
  // 타임라인은 보통 1페이지에 있다 — 2페이지까지만 본다(댓글이 많은 VOD 대비).
  for (let page = 1; page <= 2; page += 1) {
    try {
      const res = await fetch(
        `https://chapi.sooplive.co.kr/api/${hostId}/title/${titleNo}/comment?page=${page}&per_page=30`,
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
  // 게스트 출연분(0075)은 호스트 채널 경로로 — host_id를 한 번에 읽는다.
  const hostRes = await supabase.from("vod_archive").select("title_no, host_id").in("title_no", titleNos);
  const hostOf = new Map<number, string>();
  for (const r of ((hostRes.data as { title_no: number; host_id: string | null }[] | null) ?? [])) {
    if (typeof r.host_id === "string" && r.host_id) hostOf.set(Number(r.title_no), r.host_id);
  }
  for (const titleNo of titleNos) {
    const comments = await fetchComments(titleNo, hostOf.get(titleNo) ?? BJ_ID);
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
