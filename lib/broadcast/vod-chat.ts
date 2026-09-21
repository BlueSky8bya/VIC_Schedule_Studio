import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { kstDayKey } from "@/lib/calendar/month";

// 다시보기 채팅 리플레이 수집기(0088/0089/0090) — 숲 비공식 API.
//
//  1) VOD 보기 API: POST https://api.m.sooplive.co.kr/station/video/a/view (nTitleNo, nApiLevel=10)
//     → data.files[] 각각의 chat = "https://videoimg.sooplive.co.kr/php/ChatLoadSplit.php?rowKey=…_c",
//       duration(ms). (2026-09-18 실측: 200, 파일 2개 = 1부·2부)
//  2) 조각: chat 주소 + "&startTime=N" (300초 구간, 2026-09-21 확인) → XML.
//
// 저장 원칙: 메시지 원문·아이디(<u>)·닉(<n>)은 **절대 저장하지 않는다**. 남기는 것은
//   · 방송별 단어 빈도(vod_chat_terms)
//   · 30초 구간별 메시지 수·고유 발화자 **수**·웃음 점수·상위 단어(vod_chat_bins) — 발화자 식별자는 이 함수 안에서만 산다
//   · 채팅에 나온 **아는 스트리머** 이름·인사(vod_chat_people) — search_known_people()이 준 이름만. 시청자 이름은 수집 사고(소유자).
// 토큰: 한글 2~6자, 라틴·숫자 3~12자. ㅋㅋ·ㅠㅠ 류 자모 반복은 버린다(ㅋ는 웃음 점수로만 센다).
// 숲 이모티콘 "/빅하/"는 통째로 버린다(소유자 2026-09-18: 영양가 없음; 0089). "○○님" 꼴은 아는 이름일 때만 남긴다.
// 예의: 조각 사이 150ms, 한 번의 호출에 조각 예산(chunkBudget)을 넘기지 않는다. 실패는 조용히(다음 회차).

const VIEW_API = "https://api.m.sooplive.co.kr/station/video/a/view";
const CHUNK_SEC = 300;
const BIN_SEC = 30;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120";

type ViewFile = { chat?: string; duration?: number | string; file_order?: number | string };
type ChatFile = { chat: string | null; durationSec: number };

async function fetchChatFiles(titleNo: number, timeoutMs: number): Promise<ChatFile[] | null> {
  try {
    const res = await fetch(VIEW_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA,
        Referer: `https://vod.sooplive.co.kr/player/${titleNo}` },
      body: `nTitleNo=${titleNo}&nApiLevel=10&nPlaylistIdx=0`, cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) return null;
    const json = await res.json() as { result?: number; data?: { files?: ViewFile[] } };
    if (json.result !== 1 || !Array.isArray(json.data?.files)) return null;
    if (json.data.files.some(f => !Number.isFinite(Number(f.duration)) || Number(f.duration) < 0 || Number(f.duration) > 7 * 86400_000)) return null;
    return [...json.data.files].sort((a, b) => Number(a.file_order ?? 0) - Number(b.file_order ?? 0)).map(f => {
      let chat: string | null = null;
      try {
        const url = new URL(f.chat ?? "");
        // External source URLs never get arbitrary server fetch authority.
        if (url.protocol === "https:" && url.hostname === "videoimg.sooplive.co.kr" &&
            url.pathname === "/php/ChatLoadSplit.php" && !url.username && !url.password && !url.port) chat = url.href;
      } catch { /* missing chat is a retryable gap; keep the file's time offset */ }
      return { chat, durationSec: Math.max(0, Number(f.duration ?? 0) / 1000) };
    });
  } catch { return null; }
}

// XML 조각에서 (본문, 발화자 표식, 시각)만 뽑는다 — 파서 없이도 <chat>…</chat> 구조가 고정이다.
// 발화자 표식(<u>)은 구간별 고유 수를 세는 데만 쓰고 이 모듈 밖으로 나가지 않는다.
const CHAT_RE = /<chat>([\s\S]*?)<\/chat>/g;
const M_RE = /<m><!\[CDATA\[([\s\S]*?)\]\]><\/m>/;
const U_RE = /<u>([\s\S]*?)<\/u>/;
const T_RE = /<t>([\d.]+)<\/t>/;

export type ChatMsg = { m: string; u: string; t: number };

export function extractMessages(xml: string): ChatMsg[] {
  const out: ChatMsg[] = [];
  for (const c of xml.matchAll(CHAT_RE)) {
    const body = c[1];
    const m = M_RE.exec(body);
    if (!m) continue;
    const u = U_RE.exec(body)?.[1] ?? "";
    const t = Number(T_RE.exec(body)?.[1] ?? "0");
    out.push({ m: m[1], u, t: Number.isFinite(t) ? t : 0 });
  }
  return out;
}

// 메시지 → 단어. 이모티콘(/…/)은 통째로 지우고("빅하"로 새지 않게), 나머지는 구분자로 자른다.
const EMOTE_RE = /\/([가-힣a-zA-Z0-9]{1,8})\//g;
const JAMO_ONLY = /^[ㄱ-ㅎㅏ-ㅣ]+$/;

export function tokenize(msg: string, known?: ReadonlySet<string>): string[] {
  const out: string[] = [];
  const rest = msg.replace(EMOTE_RE, " ");
  for (const raw of rest.split(/[^가-힣a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ]+/)) {
    if (!raw) continue;
    let w = raw.toLowerCase();
    if (JAMO_ONLY.test(w)) continue; // ㅋㅋㅋ ㅠㅠ
    if (/^[0-9]+$/.test(w)) continue;
    // "○○님" — 아는 스트리머 이름이면 이름으로, 아니면 버린다(시청자 이름 수집 방지).
    if (w.length >= 3 && w.endsWith("님") && /^[가-힣]+$/.test(w)) {
      const base = w.slice(0, -1);
      if (!known?.has(base)) continue;
      w = base;
    }
    if (/^[가-힣]{2,6}$/.test(w) || /^[a-z0-9]{3,12}$/.test(w)) out.push(w);
  }
  return out;
}

// 웃음 점수: 메시지 안의 ㅋ 개수(12 캡). "ㅎㅎ"도 절반으로 친다.
export function laughScore(msg: string): number {
  let k = 0;
  let h = 0;
  for (const ch of msg) {
    if (ch === "ㅋ") k += 1;
    else if (ch === "ㅎ") h += 1;
  }
  return Math.min(12, k + Math.floor(h / 2));
}

// 구간 상위 단어에서 뺄 말 — 인사·추임새·토리님 호칭(어느 구간에나 있어 특징이 안 된다).
const BIN_STOP = new Set([
  "토리", "토리님", "토리야", "빅토리", "빅토리님", "안녕", "안녕하세요", "하이", "바이", "잘가", "잘자", "감사", "감사합니다",
  "진짜", "근데", "그냥", "아니", "뭐야", "대박", "와우", "이거", "저거", "그거", "이제", "지금", "오늘", "내일", "다들", "저도",
  "나도", "우리", "너무", "정말", "완전", "사람", "방송", "하나", "그래", "아아", "오오", "우와", "헐", "네네", "넵", "예",
  "ㅋㅋ", "ㅋㅋㅋ", "ㅎㅎ", "ㅠㅠ", "오케이", "굿", "굳", "가자", "고고", "화이팅", "파이팅", "아하", "어허", "오호", "엥", "잉", "흠", "음", "아니야", "맞아", "맞다", "그치", "그쵸", "왜요", "뭐지", "뭔데", "언제", "어디", "누구", "이게", "그게", "저게", "있다", "없다", "된다", "한다", "하네", "하다", "이다"
]);

export type Bin = { msgs: number; speakers: Set<string>; laugh: number; terms: Map<string, number> };

// 별명 변형(소유자 2026-09-18): 시청자는 "빅토리"를 비틀어 부른다 — 탐토리·탐정토리·바보토리(○○토리), 빅드럭·빅명한(빅○○),
// 야키토리. 어간을 풀어 같이 센다: "탐정토리" → 탐정, "탐토리" → 탐 → 그 방송 제목·챕터 낱말 중 '탐'으로 시작하는 말(탐정)로.
// 음절을 바꿔치기한 말장난(빅명한 = 빅+유명한)은 규칙으로 못 푼다 — 어간 "명한"만 남는다(한계).
const OWNER_SUFFIX = /^([가-힣]{1,4})토리$/;
const OWNER_PREFIX = /^빅([가-힣]{1,4})$/;
export function nicknameStems(token: string, docWords: ReadonlySet<string>): string[] {
  const m = OWNER_SUFFIX.exec(token) ?? OWNER_PREFIX.exec(token);
  if (!m) return [];
  const stem = m[1];
  if (stem === "토" || stem === "토리") return [];
  const out: string[] = [];
  if (stem.length >= 2) out.push(stem);
  // 한 글자 어간(탐)은 그 방송의 제목·챕터 낱말로 푼다(탐→탐정). 후보가 셋을 넘으면 뜻이 없다.
  const cands = [...docWords].filter((w) => w.length >= 2 && w !== stem && w.startsWith(stem));
  if (cands.length >= 1 && cands.length <= 3) for (const w of cands) if (!out.includes(w)) out.push(w);
  return out;
}

export function docWordSet(texts: string[]): Set<string> {
  const out = new Set<string>();
  for (const t of texts) for (const w of t.split(/[^가-힣]+/)) if (/^[가-힣]{2,6}$/.test(w)) out.add(w);
  return out;
}

// 토리님 호칭의 굴절형("토리는", "토리면", "빅토리가")도 특징이 못 된다.
const OWNER_RE = /^(빅)?토리/;
// 소유자 이름은 '방문 인물'이 아니다(vod_chat_people 제외).
const OWNER_NAMES = new Set(["토리", "빅토리", "토리야", "토리님", "빅토리님"]);

export function topBinTerms(terms: Map<string, number>, n = 3): string[] {
  return [...terms.entries()]
    .filter(([t, c]) => c >= 2 && !BIN_STOP.has(t) && !OWNER_RE.test(t) && /^[가-힣]{2,6}$/.test(t))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([t]) => t);
}

type KnownPeople = { names: ReadonlySet<string>; greetings: ReadonlyMap<string, string> };

async function loadKnownPeople(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, deadline: number): Promise<KnownPeople> {
  const names = new Set<string>();
  const greetings = new Map<string, string>();
  const { data, error } = await supabase.rpc("search_known_people")
    .abortSignal(AbortSignal.timeout(Math.max(1, deadline - Date.now())));
  if (error) throw new Error("chat dictionary unavailable");
  for (const r of (data ?? []) as { name: string; greeting: string | null }[]) {
    names.add(r.name);
    if (r.greeting) greetings.set(r.greeting, r.name);
  }
  return { names, greetings };
}

type StoredBin = { msgs: number; speakers: number; laugh: number; terms: Record<string, number> };
export type ChatJobState = {
  sourceKey: string; cursor: number; missing: number[]; chunks: number; messages: number; retries: number;
  terms: Record<string, Record<string, number>>;
  bins: Record<string, StoredBin>;
  people: Record<string, { greetings: number; mentions: number }>;
};
type ChatJob = { revision: number; state: ChatJobState | null; complete: boolean };
type Chunk = { url: string | null; offset: number; start: number; end: number };

function newState(sourceKey: string): ChatJobState {
  return { sourceKey, cursor: 0, missing: [], chunks: 0, messages: 0, retries: 0,
    terms: {}, bins: {}, people: {} };
}

function addMessages(state: ChatJobState, msgs: ChatMsg[], chunk: Chunk, known: KnownPeople, words: ReadonlySet<string>) {
  const speakers = new Map<number, Set<string>>(); // ephemeral; never serialized
  for (const msg of msgs) {
    // Split endpoints can repeat a boundary message. Each interval owns [start,end).
    if (msg.t < chunk.start || msg.t >= chunk.end) continue;
    const bin = Math.floor((chunk.offset + msg.t) / BIN_SEC);
    const b = state.bins[bin] ??= { msgs: 0, speakers: 0, laugh: 0, terms: {} };
    b.msgs++; state.messages++; b.laugh += laughScore(msg.m);
    if (msg.u) {
      const ids = speakers.get(bin) ?? new Set<string>();
      ids.add(msg.u); speakers.set(bin, ids);
    }
    const tokens = tokenize(msg.m, known.names);
    for (const t of [...tokens]) tokens.push(...nicknameStems(t, words));
    for (const t of tokens) {
      if (!Object.hasOwn(state.terms, t)) state.terms[t] = {};
      const counts = state.terms[t];
      counts[bin] = (counts[bin] ?? 0) + 1;
      b.terms[t] = (Object.hasOwn(b.terms, t) ? b.terms[t] : 0) + 1;
      const viaGreeting = known.greetings.get(t);
      if (OWNER_NAMES.has(t)) continue;
      const name = viaGreeting ?? (known.names.has(t) ? t : null);
      if (name) {
        const person = state.people[name] ??= { greetings: 0, mentions: 0 };
        if (viaGreeting) person.greetings++; else person.mentions++;
      }
    }
  }
  // At file/chunk boundaries this is a summed count, not a retained identity union.
  for (const [bin, ids] of speakers) state.bins[bin].speakers += ids.size;
}

export function chatSnapshot(state: ChatJobState) {
  return {
    terms: Object.entries(state.terms).map(([term, counts]) => {
      const entries = Object.entries(counts).map(([bin, n]) => [Number(bin), n] as const);
      const peak = entries.reduce((a, b) => b[1] > a[1] ? b : a);
      return { term, cnt: entries.reduce((sum, [, n]) => sum + n, 0), peak_bin: peak[0], peak_cnt: peak[1], bins: entries.length };
    }),
    bins: Object.entries(state.bins).map(([bin, b]) => ({ bin: Number(bin), msgs: b.msgs,
      speakers: b.speakers, laugh: b.laugh, terms: topBinTerms(new Map(Object.entries(b.terms))) })),
    people: Object.entries(state.people).map(([name, p]) => ({ name, greetings: p.greetings, mentions: p.mentions }))
  };
}

/** Checkpoint aggregate-only state atomically. Missing chunks never block later files. */
export async function syncVodChat(titleNos: number[], chunkBudget = 60, timeBudgetMs = 35_000): Promise<{
  ok: boolean; vods: number; chunks: number; messages: number;
}> {
  const db = createSupabaseAdminClient();
  if (!db || !titleNos.length) return { ok: false, vods: 0, chunks: 0, messages: 0 };
  const deadline = Date.now() + Math.max(0, timeBudgetMs);
  let budget = Number.isFinite(chunkBudget) ? Math.max(0, Math.floor(chunkBudget)) : 0;
  let vods = 0, chunks = 0, messages = 0, ok = true;
  let known: KnownPeople;
  try { known = await loadKnownPeople(db, deadline); }
  catch { return { ok: false, vods, chunks, messages }; }
  for (const titleNo of [...new Set(titleNos)]) {
    if (budget <= 0 || Date.now() >= deadline - 1000) break;
    const [archive, previous, labels] = await Promise.all([
      db.from("vod_archive").select("title,auth_no,broadcast_day").eq("title_no", titleNo)
        .abortSignal(AbortSignal.timeout(Math.max(1, deadline - Date.now()))).maybeSingle(),
      db.from("vod_chat_job").select("revision,state,complete").eq("title_no", titleNo)
        .abortSignal(AbortSignal.timeout(Math.max(1, deadline - Date.now()))).maybeSingle(),
      db.from("vod_chapter_index").select("label").eq("title_no", titleNo).order("sec")
        .abortSignal(AbortSignal.timeout(Math.max(1, deadline - Date.now()))).limit(400)
    ]);
    if (archive.error || previous.error || labels.error) { ok = false; continue; }
    if (archive.data?.auth_no !== 101) continue;
    const prev = previous.data as ChatJob | null;
    const remaining = deadline - Date.now() - 5000;
    if (remaining <= 0) break;
    const files = await fetchChatFiles(titleNo, Math.min(8000, remaining));
    const words = docWordSet([String(archive.data.title ?? ""),
      ...((labels.data ?? []) as { label: string }[]).map(r => r.label)]);
    const plan: Chunk[] = [];
    let offset = 0;
    for (const f of files ?? []) {
      if (!Number.isFinite(f.durationSec) || f.durationSec <= 0) continue;
      const n = Math.ceil(f.durationSec / CHUNK_SEC);
      for (let i = 0; i < n; i++) {
        const url = f.chat ? new URL(f.chat) : null;
        url?.searchParams.set("startTime", String(i * CHUNK_SEC));
        plan.push({ url: url?.href ?? null, offset, start: i * CHUNK_SEC, end: Math.min((i + 1) * CHUNK_SEC, f.durationSec) });
      }
      offset += f.durationSec; // preserve fractional/missing-file offsets
    }
    const sourceKey = createHash("sha256").update(JSON.stringify([files, [...words].sort()])).digest("hex");
    let state = prev?.state && prev.state.sourceKey === sourceKey && !prev.complete
      ? structuredClone(prev.state) : newState(sourceKey);
    let gainedChunks = 0, gainedMessages = 0;
    const previousCursor = state.cursor;
    // Empty/unavailable metadata is retryable; preserve the previous checkpoint.
    if (!files?.length || !plan.length) state = prev?.state ? structuredClone(prev.state) : state;
    else {
      const pending = state.cursor < plan.length
        ? Array.from({ length: plan.length - state.cursor }, (_, i) => state.cursor + i)
        : [...state.missing];
      for (const index of pending) {
        const timeLeft = deadline - Date.now() - 5000;
        if (budget <= 0 || timeLeft <= 0) break;
        budget--; // failures consume budget as well
        const chunk = plan[index];
        let fetched = false;
        try {
          if (chunk.url) {
            const res = await fetch(chunk.url, { headers: { "User-Agent": UA }, cache: "no-store",
              redirect: "error", signal: AbortSignal.timeout(Math.min(8000, timeLeft)) });
            if (res.ok) {
              const xml = await res.text();
              if (!/<root(?:\s[^>]*)?>[\s\S]*<\/root>/.test(xml)) throw new Error("invalid chat XML");
              const parsed = extractMessages(xml);
              if (xml.includes("<chat>") && parsed.length === 0) throw new Error("invalid chat messages");
              const before = state.messages;
              addMessages(state, parsed, chunk, known, words);
              gainedMessages += state.messages - before;
              state.chunks++; gainedChunks++; fetched = true;
            }
          }
        } catch { /* retry missing or temporarily unreadable chunks in a later job */ }
        state.cursor = Math.max(state.cursor, index + 1);
        state.missing = state.missing.filter(n => n !== index);
        if (!fetched) state.missing.push(index);
        if (Date.now() < deadline - 1200) await new Promise(r => setTimeout(r, 150));
      }
    }
    const traversed = !!files?.length && plan.length > 0 && state.cursor >= plan.length;
    const complete = traversed && state.missing.length === 0;
    state.retries = traversed && !complete ? state.retries + 1 : 0;
    const ageDays = (Date.parse(kstDayKey()) - Date.parse(String(archive.data.broadcast_day))) / 86400_000;
    const completeRetryMs = ageDays >= 0 && ageDays < 14 ? 86400_000 : 30 * 86400_000;
    const retryMs = complete ? completeRetryMs : !files?.length || !plan.length ? 3600_000 :
      traversed ? Math.min(24 * 3600_000, 600_000 * 2 ** Math.min(state.retries - 1, 8)) : 60_000;
    const { data: applied, error } = await db.rpc("vod_chat_commit_job", {
      p_title_no: titleNo, p_revision: prev?.revision ?? 0,
      p_job: { state: complete ? null : state, complete, chunks: state.chunks, messages: state.messages,
        nextRetryAt: new Date(Date.now() + retryMs).toISOString() },
      // Preserve previous profile until a full source traversal; publish valid portions despite gaps.
      p_snapshot: traversed && state.chunks > 0 && (gainedChunks > 0 || previousCursor < plan.length) ? chatSnapshot(state) : null
    }).abortSignal(AbortSignal.timeout(Math.max(1, deadline - Date.now())));
    if (error) { ok = false; continue; }
    if (applied) { vods++; chunks += gainedChunks; messages += gainedMessages; }
  }
  return { ok, vods, chunks, messages };
}

/** All public archives remain eligible; DB queue has no age or PostgREST row cap. */
export async function pickChatSyncTargets(limit: number): Promise<number[]> {
  const db = createSupabaseAdminClient();
  if (!db) return [];
  const { data, error } = await db.rpc("vod_chat_pick_jobs", { p_limit: limit }).abortSignal(AbortSignal.timeout(5000));
  if (error) return [];
  return ((data ?? []) as { title_no: number }[]).map(r => Number(r.title_no));
}
