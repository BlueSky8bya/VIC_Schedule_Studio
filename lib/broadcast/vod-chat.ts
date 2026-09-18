import { createSupabaseAdminClient } from "@/lib/auth/admin";

// 다시보기 채팅 리플레이 수집기(0088/0089/0090) — 숲 비공식 API.
//
//  1) VOD 보기 API: POST https://api.m.sooplive.co.kr/station/video/a/view (nTitleNo, nApiLevel=10)
//     → data.files[] 각각의 chat = "https://videoimg.sooplive.co.kr/php/ChatLoadSplit.php?rowKey=…_c",
//       duration(ms). (2026-09-18 실측: 200, 파일 2개 = 1부·2부)
//  2) 조각: chat 주소 + "&startTime=N" (600초 단위) → XML <root><chat><m><![CDATA[메시지]]></m><u>아이디</u><t>초</t></chat>…
//
// 저장 원칙: 메시지 원문·아이디(<u>)·닉(<n>)은 **절대 저장하지 않는다**. 남기는 것은
//   · 방송별 단어 빈도(vod_chat_terms)
//   · 30초 구간별 메시지 수·고유 발화자 **수**·웃음 점수·상위 단어(vod_chat_bins) — 발화자 식별자는 이 함수 안에서만 산다
//   · 채팅에 나온 **아는 스트리머** 이름·인사(vod_chat_people) — search_known_people()이 준 이름만. 시청자 이름은 수집 사고(소유자).
// 토큰: 한글 2~6자, 라틴·숫자 3~12자. ㅋㅋ·ㅠㅠ 류 자모 반복은 버린다(ㅋ는 웃음 점수로만 센다).
// 숲 이모티콘 "/빅하/"는 통째로 버린다(소유자 2026-09-18: 영양가 없음; 0089). "○○님" 꼴은 아는 이름일 때만 남긴다.
// 예의: 조각 사이 150ms, 한 번의 호출에 조각 예산(chunkBudget)을 넘기지 않는다. 실패는 조용히(다음 회차).

const VIEW_API = "https://api.m.sooplive.co.kr/station/video/a/view";
const CHUNK_SEC = 600;
const BIN_SEC = 30;
const MAX_CHUNKS_PER_VOD = 200; // 33시간 — 그 이상은 잘라도 학습에 지장 없다
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120";

type ViewFile = { chat?: string; duration?: number | string; file_order?: number | string };

async function fetchChatFiles(titleNo: number): Promise<{ chat: string; durationSec: number }[]> {
  try {
    const res = await fetch(VIEW_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
        Referer: `https://vod.sooplive.co.kr/player/${titleNo}`
      },
      body: `nTitleNo=${titleNo}&nApiLevel=10&nPlaylistIdx=0`,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000)
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { result?: number; data?: { files?: ViewFile[] } };
    if (json.result !== 1 || !json.data?.files) return [];
    return json.data.files
      .filter((f) => typeof f.chat === "string" && f.chat.includes("ChatLoadSplit"))
      .map((f) => ({ chat: f.chat as string, durationSec: Math.max(0, Math.floor(Number(f.duration ?? 0) / 1000)) }));
  } catch {
    return [];
  }
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

async function loadKnownPeople(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>): Promise<KnownPeople> {
  const names = new Set<string>();
  const greetings = new Map<string, string>();
  const { data } = await supabase.rpc("search_known_people");
  for (const r of (data ?? []) as { name: string; greeting: string | null }[]) {
    names.add(r.name);
    if (r.greeting) greetings.set(r.greeting, r.name);
  }
  return { names, greetings };
}

/**
 * 주어진 VOD들의 채팅 단어 빈도·구간 프로필·아는 스트리머 방문을 수집해 저장한다. chunkBudget = 이번 호출에 받을 조각 수 상한.
 * 이미 절반 넘게 받은 VOD는 이어서 받는다(vod_chat_sync.chunks부터).
 */
export async function syncVodChat(
  titleNos: number[],
  chunkBudget = 60
): Promise<{ ok: boolean; vods: number; chunks: number; messages: number }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase || titleNos.length === 0) return { ok: false, vods: 0, chunks: 0, messages: 0 };
  const known = await loadKnownPeople(supabase);
  let budget = chunkBudget;
  let vods = 0;
  let chunksTotal = 0;
  let messagesTotal = 0;
  for (const titleNo of titleNos) {
    if (budget <= 0) break;
    const files = await fetchChatFiles(titleNo);
    if (files.length === 0) {
      // 채팅이 없는(또는 못 읽는) VOD — 완료로 표시해 다시 시도하지 않는다.
      await supabase.from("vod_chat_sync").upsert({ title_no: titleNo, chunks: 0, messages: 0, complete: true, synced_at: new Date().toISOString() });
      continue;
    }
    const prev = await supabase.from("vod_chat_sync").select("chunks, messages").eq("title_no", titleNo).maybeSingle();
    let doneChunks = Number(prev.data?.chunks ?? 0);
    let messages = Number(prev.data?.messages ?? 0);
    // 파일별 조각 목록(전체) — 이어받기를 위해 평탄화. 여러 파일(1부·2부)은 시각을 이어 붙인다.
    const plan: { url: string; offset: number }[] = [];
    let offset = 0;
    for (const f of files) {
      const n = Math.min(MAX_CHUNKS_PER_VOD, Math.ceil(f.durationSec / CHUNK_SEC) || 1);
      for (let i = 0; i < n; i += 1) plan.push({ url: `${f.chat}&startTime=${i * CHUNK_SEC}`, offset });
      offset += f.durationSec;
    }
    const counts = new Map<string, number>();
    const termBins = new Map<string, Map<number, number>>(); // 단어 → 구간별 횟수(봉우리 구간용)
    const bins = new Map<number, Bin>();
    // 별명 어간을 풀 낱말 — 이 방송 제목·팬 챕터
    const docRows = await Promise.all([
      supabase.from("vod_archive").select("title").eq("title_no", titleNo).maybeSingle(),
      supabase.from("vod_chapter_index").select("label").eq("title_no", titleNo).limit(400)
    ]);
    const docWords = docWordSet([
      String(docRows[0].data?.title ?? ""),
      ...((docRows[1].data ?? []) as { label: string }[]).map((r) => r.label)
    ]);
    const people = new Map<string, { greetings: number; mentions: number }>();
    let i = doneChunks;
    for (; i < plan.length && budget > 0; i += 1, budget -= 1) {
      try {
        const res = await fetch(plan[i].url, { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
        if (!res.ok) break;
        const xml = await res.text();
        const msgs = extractMessages(xml);
        messages += msgs.length;
        for (const msg of msgs) {
          const binNo = Math.max(0, Math.floor((plan[i].offset + msg.t) / BIN_SEC));
          let b = bins.get(binNo);
          if (!b) {
            b = { msgs: 0, speakers: new Set(), laugh: 0, terms: new Map() };
            bins.set(binNo, b);
          }
          b.msgs += 1;
          if (msg.u) b.speakers.add(msg.u);
          b.laugh += laughScore(msg.m);
          const toks = tokenize(msg.m, known.names);
          for (const t of [...toks]) for (const stem of nicknameStems(t, docWords)) toks.push(stem);
          for (const t of toks) {
            counts.set(t, (counts.get(t) ?? 0) + 1);
            b.terms.set(t, (b.terms.get(t) ?? 0) + 1);
            let tb = termBins.get(t);
            if (!tb) {
              tb = new Map();
              termBins.set(t, tb);
            }
            tb.set(binNo, (tb.get(binNo) ?? 0) + 1);
            const viaGreeting = known.greetings.get(t);
            if (OWNER_NAMES.has(t)) {
              /* 토리님 본인 — 방문 아님 */
            } else if (viaGreeting) {
              const p = people.get(viaGreeting) ?? { greetings: 0, mentions: 0 };
              p.greetings += 1;
              people.set(viaGreeting, p);
            } else if (known.names.has(t)) {
              const p = people.get(t) ?? { greetings: 0, mentions: 0 };
              p.mentions += 1;
              people.set(t, p);
            }
          }
        }
      } catch {
        break;
      }
      chunksTotal += 1;
      await new Promise((r) => setTimeout(r, 150));
    }
    const fetchedThisPass = i - (Number(prev.data?.chunks ?? 0));
    doneChunks = i;
    // 실패 안전장치(2026-09-18 실측: 한 VOD가 계획보다 짧은 조각 목록이라 다음 조각이 계속 실패 → 무한 재시도).
    // 이번 회차에 조각을 하나도 못 받았는데 남은 계획이 있으면 포기하고 완료로 표시한다(받은 만큼만 학습).
    const giveUp = fetchedThisPass === 0 && budget > 0 && doneChunks < plan.length;
    if (counts.size > 0) {
      // 기존 빈도에 더한다(이어받기). 한 번에 upsert하되 충돌 시 합산은 RPC 없이 두 단계로.
      const terms = [...counts.entries()];
      const existing = await supabase
        .from("vod_chat_terms")
        .select("term, cnt, peak_bin, peak_cnt, bins")
        .eq("title_no", titleNo)
        .in("term", terms.map(([t]) => t));
      const have = new Map(
        ((existing.data ?? []) as { term: string; cnt: number; peak_bin: number | null; peak_cnt: number; bins: number }[]).map((r) => [r.term, r])
      );
      const rows = terms.map(([term, cnt]) => {
        const h = have.get(term);
        const tb = termBins.get(term) ?? new Map<number, number>();
        let peakBin: number | null = h?.peak_bin ?? null;
        let peakCnt = Number(h?.peak_cnt ?? 0);
        for (const [bin, n] of tb) if (n > peakCnt) { peakCnt = n; peakBin = bin; }
        return { title_no: titleNo, term, cnt: cnt + Number(h?.cnt ?? 0), peak_bin: peakBin, peak_cnt: peakCnt, bins: tb.size + Number(h?.bins ?? 0) };
      });
      for (let k = 0; k < rows.length; k += 500) {
        const { error } = await supabase.from("vod_chat_terms").upsert(rows.slice(k, k + 500), { onConflict: "title_no,term" });
        if (error) console.warn("[vod-chat] upsert failed:", error.message);
      }
    }
    if (bins.size > 0) {
      // 구간은 조각 경계(600초)가 30초의 배수라 겹치지 않는다 — 덮어써도 된다. 발화자 집합은 여기서 개수로만 남는다.
      const rows = [...bins.entries()].map(([bin, b]) => ({
        title_no: titleNo,
        bin,
        msgs: b.msgs,
        speakers: b.speakers.size,
        laugh: b.laugh,
        terms: topBinTerms(b.terms)
      }));
      for (let k = 0; k < rows.length; k += 500) {
        const { error } = await supabase.from("vod_chat_bins").upsert(rows.slice(k, k + 500), { onConflict: "title_no,bin" });
        if (error) console.warn("[vod-chat] bins upsert failed:", error.message);
      }
    }
    if (people.size > 0) {
      const names = [...people.keys()];
      const existing = await supabase.from("vod_chat_people").select("name, greetings, mentions").eq("title_no", titleNo).in("name", names);
      const have = new Map(((existing.data ?? []) as { name: string; greetings: number; mentions: number }[]).map((r) => [r.name, r]));
      const rows = names.map((name) => {
        const p = people.get(name)!;
        const h = have.get(name);
        return { title_no: titleNo, name, greetings: p.greetings + Number(h?.greetings ?? 0), mentions: p.mentions + Number(h?.mentions ?? 0) };
      });
      const { error } = await supabase.from("vod_chat_people").upsert(rows, { onConflict: "title_no,name" });
      if (error) console.warn("[vod-chat] people upsert failed:", error.message);
    }
    await supabase.from("vod_chat_sync").upsert({
      title_no: titleNo,
      chunks: doneChunks,
      messages,
      complete: doneChunks >= plan.length || giveUp,
      synced_at: new Date().toISOString()
    });
    vods += 1;
    messagesTotal += messages;
  }
  return { ok: true, vods, chunks: chunksTotal, messages: messagesTotal };
}

/** 아직 채팅을 다 못 받은 공개 VOD — 최신부터 N개. */
export async function pickChatSyncTargets(limit: number): Promise<number[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];
  const done = await supabase.from("vod_chat_sync").select("title_no").eq("complete", true).limit(5000);
  const doneSet = new Set(((done.data ?? []) as { title_no: number }[]).map((r) => Number(r.title_no)));
  const vods = await supabase
    .from("vod_archive")
    .select("title_no")
    .eq("auth_no", 101)
    .order("broadcast_day", { ascending: false })
    .limit(2000);
  return ((vods.data ?? []) as { title_no: number }[])
    .map((r) => Number(r.title_no))
    .filter((n) => !doneSet.has(n))
    .slice(0, limit);
}
