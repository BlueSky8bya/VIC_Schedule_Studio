// 다시보기 채팅 단어 백필(0088~0093) — 로컬에서 한 번에 돌리는 스크립트. GH Actions(최신부터 4개/회)와 겹치지 않게
// **오래된 방송부터** 받는다. 원문·닉은 저장하지 않는다. 다 받으면 그래프·동의어·공연·게임 사전을 다시 배운다.
//   npx tsx scripts/vod-chat-backfill.mts [chunksPerVod=400]
import { readFileSync } from "node:fs";

for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}
const { syncVodChat } = await import("../lib/broadcast/vod-chat");
const { createSupabaseAdminClient } = await import("../lib/auth/admin");

const supabase = createSupabaseAdminClient();
if (!supabase) throw new Error("no admin client");
const budget = Number(process.argv[2] ?? 400);

async function oldestPending(): Promise<number | null> {
  const done = await supabase!.from("vod_chat_sync").select("title_no").eq("complete", true).limit(5000);
  const doneSet = new Set(((done.data ?? []) as { title_no: number }[]).map((r) => Number(r.title_no)));
  const vods = await supabase!.from("vod_archive").select("title_no").eq("auth_no", 101).order("broadcast_day", { ascending: true }).limit(2000);
  for (const r of (vods.data ?? []) as { title_no: number }[]) if (!doneSet.has(Number(r.title_no))) return Number(r.title_no);
  return null;
}

let n = 0;
const seen = new Set<number>();
const t0 = Date.now();
for (;;) {
  const target = await oldestPending();
  if (target === null) break;
  if (seen.has(target)) {
    // 같은 VOD가 두 번 연속이면 수집기가 완료 표시를 못 한 것 — 무한 반복 대신 강제 완료.
    await supabase.from("vod_chat_sync").upsert({ title_no: target, complete: true, synced_at: new Date().toISOString() });
    console.log("forced complete", target);
    continue;
  }
  seen.add(target);
  const r = await syncVodChat([target], budget);
  n += 1;
  console.log(`[${new Date().toISOString().slice(11, 19)}] #${n} vod ${target} chunks=${r.chunks} msgs=${r.messages} elapsed=${Math.round((Date.now() - t0) / 60000)}m`);
  if (!r.ok) break;
}
for (const fn of ["search_song_refresh", "search_game_refresh", "search_graph_rebuild", "search_term_graph_rebuild", "search_synonyms_rebuild"] as const) {
  const { error } = await supabase.rpc(fn);
  console.log(fn, error ? `FAILED ${error.message}` : "ok");
}
console.log("done", n, "vods");
process.exit(0);
