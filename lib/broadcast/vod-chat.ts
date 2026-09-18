import { createSupabaseAdminClient } from "@/lib/auth/admin";

// 다시보기 채팅 리플레이 수집기(0088) — 숲 비공식 API.
//
//  1) VOD 보기 API: POST https://api.m.sooplive.co.kr/station/video/a/view (nTitleNo, nApiLevel=10)
//     → data.files[] 각각의 chat = "https://videoimg.sooplive.co.kr/php/ChatLoadSplit.php?rowKey=…_c",
//       duration(ms). (2026-09-18 실측: 200, 파일 2개 = 1부·2부)
//  2) 조각: chat 주소 + "&startTime=N" (600초 단위) → XML <root><chat><m><![CDATA[메시지]]></m>…<t>초</t></chat>…
//
// 저장 원칙: 메시지 원문·아이디(<u>)·닉(<n>)은 **절대 저장하지 않는다**. 방송별 단어 빈도(vod_chat_terms)만.
// 토큰: 한글 2~6자, 라틴·숫자 3~12자. ㅋㅋ·ㅠㅠ 류 자모 반복은 버린다.
// 숲 이모티콘 "/빅하/"는 통째로 버린다(소유자 2026-09-18: 영양가 없음 — 요즘/관련어 칩에 올리지 않는다; 0089).
// 예의: 조각 사이 150ms, 한 번의 호출에 조각 예산(chunkBudget)을 넘기지 않는다. 실패는 조용히(다음 회차).

const VIEW_API = "https://api.m.sooplive.co.kr/station/video/a/view";
const CHUNK_SEC = 600;
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

// XML 조각에서 메시지 본문만 뽑는다(정규식 — 파서 없이도 <m><![CDATA[…]]></m> 구조가 고정이다).
const MSG_RE = /<m><!\[CDATA\[([\s\S]*?)\]\]><\/m>/g;

export function extractMessages(xml: string): string[] {
  const out: string[] = [];
  for (const m of xml.matchAll(MSG_RE)) out.push(m[1]);
  return out;
}

// 메시지 → 단어. 이모티콘(/…/)은 통째로 지우고("빅하"로 새지 않게), 나머지는 구분자로 자른다.
const EMOTE_RE = /\/([가-힣a-zA-Z0-9]{1,8})\//g;
const JAMO_ONLY = /^[ㄱ-ㅎㅏ-ㅣ]+$/;

export function tokenize(msg: string): string[] {
  const out: string[] = [];
  const rest = msg.replace(EMOTE_RE, " ");
  for (const raw of rest.split(/[^가-힣a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ]+/)) {
    if (!raw) continue;
    const w = raw.toLowerCase();
    if (JAMO_ONLY.test(w)) continue; // ㅋㅋㅋ ㅠㅠ
    if (/^[0-9]+$/.test(w)) continue;
    if (/^[가-힣]{2,6}$/.test(w) || /^[a-z0-9]{3,12}$/.test(w)) out.push(w);
  }
  return out;
}

/**
 * 주어진 VOD들의 채팅 단어 빈도를 수집해 저장한다. chunkBudget = 이번 호출에 받을 조각 수 상한.
 * 이미 절반 넘게 받은 VOD는 이어서 받는다(vod_chat_sync.chunks부터).
 */
export async function syncVodChat(
  titleNos: number[],
  chunkBudget = 60
): Promise<{ ok: boolean; vods: number; chunks: number; messages: number }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase || titleNos.length === 0) return { ok: false, vods: 0, chunks: 0, messages: 0 };
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
    // 파일별 조각 목록(전체) — 이어받기를 위해 평탄화
    const plan: { url: string; start: number }[] = [];
    for (const f of files) {
      const n = Math.min(MAX_CHUNKS_PER_VOD, Math.ceil(f.durationSec / CHUNK_SEC) || 1);
      for (let i = 0; i < n; i += 1) plan.push({ url: `${f.chat}&startTime=${i * CHUNK_SEC}`, start: i * CHUNK_SEC });
    }
    const counts = new Map<string, number>();
    let i = doneChunks;
    for (; i < plan.length && budget > 0; i += 1, budget -= 1) {
      try {
        const res = await fetch(plan[i].url, { headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
        if (!res.ok) break;
        const xml = await res.text();
        const msgs = extractMessages(xml);
        messages += msgs.length;
        for (const m of msgs) for (const t of tokenize(m)) counts.set(t, (counts.get(t) ?? 0) + 1);
      } catch {
        break;
      }
      chunksTotal += 1;
      await new Promise((r) => setTimeout(r, 150));
    }
    doneChunks = i;
    if (counts.size > 0) {
      // 기존 빈도에 더한다(이어받기). 한 번에 upsert하되 충돌 시 합산은 RPC 없이 두 단계로.
      const terms = [...counts.entries()];
      const existing = await supabase.from("vod_chat_terms").select("term, cnt").eq("title_no", titleNo).in("term", terms.map(([t]) => t));
      const have = new Map<string, number>(((existing.data ?? []) as { term: string; cnt: number }[]).map((r) => [r.term, Number(r.cnt)]));
      const rows = terms.map(([term, cnt]) => ({ title_no: titleNo, term, cnt: cnt + (have.get(term) ?? 0) }));
      for (let k = 0; k < rows.length; k += 500) {
        const { error } = await supabase.from("vod_chat_terms").upsert(rows.slice(k, k + 500), { onConflict: "title_no,term" });
        if (error) console.warn("[vod-chat] upsert failed:", error.message);
      }
    }
    await supabase.from("vod_chat_sync").upsert({
      title_no: titleNo,
      chunks: doneChunks,
      messages,
      complete: doneChunks >= plan.length,
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
