import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { BJ_ID } from "@/lib/broadcast/soop";
import { syncVodArchive, syncVodArchiveDeep } from "@/lib/broadcast/vod-archive";

// 팬 타임라인(다시보기 챕터) 수집·파싱(0071) — PLAN-20260831-001 Phase 2 A안.
// 숲 다시보기 댓글에서 타임라인 댓글(타임스탬프 3개 이상)을 골라 {sec, label, section}[]로
// 파싱한다. 비공식 API + 팬 창작 포맷이라 전부 fail-soft: 못 읽으면 그 VOD만 조용히 빈다.

import { parseTimeline, decodeHtmlEntities, type TimelineEntry } from "./timeline-parser";
export { parseTimeline, type TimelineEntry } from "./timeline-parser";
import { buildTimelineCandidates, type SourceComment } from "./timeline-candidates";

type CommentItem = SourceComment;

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
export async function fetchComments(titleNo: number, hostId: string = BJ_ID): Promise<CommentItem[] | null> {
  const out: CommentItem[] = [];
  // Read all pages within one VOD budget. Incomplete responses preserve saved content.
  const signal = AbortSignal.timeout(8000);
  for (let page = 1; ; page += 1) {
    try {
      const res = await fetch(
        `https://chapi.sooplive.co.kr/api/${hostId}/title/${titleNo}/comment?page=${page}&per_page=30`,
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal }
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: CommentItem[]; meta?: { last_page?: number } };
      const lastPage = json.meta?.last_page;
      if (!Array.isArray(json.data) || !Number.isInteger(lastPage) || Number(lastPage) < page) return null;
      if (json.data.some((c) => !c || !Number.isSafeInteger(Number(c.p_comment_no)) || Number(c.p_comment_no) <= 0 || typeof c.comment !== "string")) return null;
      out.push(...json.data);
      if (page >= Number(lastPage)) break;
    } catch { return null; }
  }
  const roots = out.filter((root) => Number(root.c_comment_cnt) > 0);
  let replyIndex = 0;
  let complete = true;
  // Four workers share the VOD timeout; unrelated discussions cannot add serial latency.
  await Promise.all(Array.from({ length: Math.min(4, roots.length) }, async () => {
    while (complete && replyIndex < roots.length) {
    const root = roots[replyIndex++];
    try {
      // SOOP returns the entire reply list (per_page is ignored); verified 2026-09-21.
      const res = await fetch(`https://chapi.sooplive.co.kr/api/${hostId}/title/${titleNo}/comment/${root.p_comment_no}/reply`,
        { headers: { "User-Agent": "Mozilla/5.0" }, cache: "no-store", signal });
      if (!res.ok) { complete = false; return; }
      const body = await res.json() as { data?: SourceComment[]; reply_hidden_list?: unknown[] };
      if (!Array.isArray(body.data) || body.data.length + (body.reply_hidden_list?.length ?? 0) < Number(root.c_comment_cnt) ||
          body.data.some((r) => !r || Number(r.p_comment_no) !== Number(root.p_comment_no) ||
            !Number.isSafeInteger(Number(r.c_comment_no)) || Number(r.c_comment_no) <= 0 || typeof r.comment !== "string")) { complete = false; return; }
      root.replies = body.data;
    } catch { complete = false; return; }
    }
  }));
  return complete ? out : null;
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
  const hostRes = await supabase.from("vod_archive").select("title_no, host_id, duration_ms").in("title_no", titleNos);
  const hostOf = new Map<number, string>();
  const durationOf = new Map<number, number>();
  if (hostRes.error) return { ok: false, saved: 0 };
  for (const r of ((hostRes.data as { title_no: number; host_id: string | null; duration_ms: number }[] | null) ?? [])) {
    durationOf.set(Number(r.title_no), Number(r.duration_ms) / 1000);
    if (typeof r.host_id === "string" && r.host_id) hostOf.set(Number(r.title_no), r.host_id);
  }
  const deadline = Date.now() + 20_000;
  for (const titleNo of titleNos) {
    if (Date.now() >= deadline) break;
    const startedAt = new Date().toISOString();
    const duration = durationOf.get(titleNo);
    const comments = duration && duration > 0 ? await fetchComments(titleNo, hostOf.get(titleNo) ?? BJ_ID) : null;
    if (comments === null) {
      // Record failed attempts without changing entries. Unavailable VODs must not starve the queue.
      const synced_at = new Date().toISOString();
      await supabase.from("vod_timeline").upsert({ title_no: titleNo, synced_at }, { onConflict: "title_no", ignoreDuplicates: true });
      await supabase.from("vod_timeline").update({ synced_at }).eq("title_no", titleNo);
      continue;
    }
    if (!(duration && duration > 0)) continue; // unknown duration must not clear a known timeline
    const candidates = buildTimelineCandidates(comments, duration);
    const { data: ingested, error } = await supabase.rpc("vod_timeline_ingest", {
      p_title_no: titleNo, p_candidates: candidates, p_started_at: startedAt
    });
    if (!error && ingested) saved += 1;
    await new Promise((r) => setTimeout(r, 200));
  }
  // 검색 동의어 자동 채굴(0078) — 새 챕터가 들어왔으니 제목↔챕터 줄임말 관계를 다시 센다.
  // 실패해도 타임라인 저장 결과와 무관(검색은 옛 사전으로 계속 돈다).
  if (saved > 0) {
    // 순서: 인물 관계 그래프(0079, 이름 변형 동의어 포함) → 줄임말 채굴(0078). 서로 독립이지만
    // 둘 다 챕터 색인을 읽으므로 upsert 뒤에 돈다.
    // ⚠ search_term_graph_rebuild는 빠져 있다(2026-09-19) — 63초짜리라 요청 수명 안에서 못 끝낸다.
    // 밤에 pg_cron이 돌린다(db/migrations/0120). 나머지는 합쳐도 20초 남짓이라 여기서 돈다.
    for (const fn of ["search_song_refresh", "search_game_refresh", "search_graph_rebuild", "search_synonyms_rebuild", "search_trending_rebuild"] as const) {
      const { error } = await supabase.rpc(fn);
      if (error) console.warn(`[search] ${fn} failed:`, error.message);
    }
  }
  return { ok: true, saved };
}

/**
 * Archive/chat refresh, only while offline. Archive timestamps throttle this work:
 * 1 minute within 30 minutes of broadcast end, 5 within 60, otherwise 30.
 * Fan timelines have an independent clock and remain eligible while live.
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
  // 채팅 단어 수집(0088) — 조금씩(평시 1 VOD·40조각 ≈ 6.7시간 분량). 백필은 /api/cron/vod-chat.
  // Vercel 함수 시간(60초) 안에 끝나도록 조각 예산을 작게 둔다.
  try {
    const { pickChatSyncTargets, syncVodChat } = await import("@/lib/broadcast/vod-chat");
    const chatBudget = tier === "burst" ? 0 : tier === "hot" ? 20 : 40;
    if (chatBudget > 0) await syncVodChat(await pickChatSyncTargets(1), chatBudget);
  } catch (err) {
    console.warn("[vod-chat] sync skipped:", (err as Error).message);
  }
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

/** Timeline polling is independent of archive refresh and live state. */
export async function maybeSyncTimelines(): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;
  const { data, error } = await supabase.from("vod_timeline").select("synced_at")
    .order("synced_at", { ascending: false }).limit(1);
  if (error) return;
  const last = data?.[0]?.synced_at;
  if (last && Date.now() - Date.parse(last) < 10 * 60_000) return;
  await syncVodTimelines(await pickTimelineSyncTargets());
}

type TimelineCandidate = { title_no: number; reg_date: string };
type TimelineAttempt = { title_no: number; synced_at: string };

/** Reserve half the batch for archive rotation; new uploads cannot starve old edits. */
export function selectTimelineTargets(vods: TimelineCandidate[], attempts: TimelineAttempt[], limit = 8, now = Date.now()): number[] {
  const synced = new Map(attempts.map((r) => [Number(r.title_no), Date.parse(r.synced_at) || 0]));
  const oldest = [...vods].sort((a, b) =>
    (synced.get(Number(a.title_no)) ?? 0) - (synced.get(Number(b.title_no)) ?? 0) || Number(a.title_no) - Number(b.title_no));
  const recent = oldest.filter((v) => Date.parse(v.reg_date) >= now - 14 * 86400_000);
  // Alternate lanes: even an 8-second timeout in the archive must leave a recent slot.
  const selected: number[] = [];
  let archiveIndex = 0;
  let recentIndex = 0;
  while (selected.length < limit) {
    const lane = selected.length % 2 === 0 ? oldest : recent;
    let candidate: TimelineCandidate | undefined;
    if (lane === oldest) {
      while (archiveIndex < oldest.length && !candidate) {
        const next = oldest[archiveIndex++];
        if (!selected.includes(Number(next.title_no))) candidate = next;
      }
    } else {
      while (recentIndex < recent.length && !candidate) {
        const next = recent[recentIndex++];
        if (!selected.includes(Number(next.title_no))) candidate = next;
      }
    }
    candidate ??= oldest.find((v) => !selected.includes(Number(v.title_no)));
    if (!candidate) break;
    selected.push(Number(candidate.title_no));
  }
  return selected;
}

/** No age or row-count cutoff: even years-old uploads remain eligible. */
export async function pickTimelineSyncTargets(limit = 8): Promise<number[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return [];
  const vods: TimelineCandidate[] = [];
  const attempts: TimelineAttempt[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("vod_archive").select("title_no, reg_date")
      .order("title_no").range(offset, offset + 499);
    if (error) return [];
    vods.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("vod_timeline").select("title_no, synced_at")
      .order("title_no").range(offset, offset + 499);
    if (error) return [];
    attempts.push(...(data ?? []));
    if (!data || data.length < 500) break;
  }
  return selectTimelineTargets(vods, attempts, limit);
}
