// Local runner for the same resumable due queue as GitHub Actions. Concurrent
// collectors are protected by atomic revision checks. Never force gaps complete.
//   npx tsx scripts/vod-chat-backfill.mts [chunksPerVod=400]
import { readFileSync } from "node:fs";

for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^"|"$/g, "");
}
const { syncVodChat, pickChatSyncTargets } = await import("../lib/broadcast/vod-chat");
const { createSupabaseAdminClient } = await import("../lib/auth/admin");

const supabase = createSupabaseAdminClient();
if (!supabase) throw new Error("no admin client");
const budget = Number(process.argv[2] ?? 400);

let n = 0;
const seen = new Set<number>();
const t0 = Date.now();
for (;;) {
  const target = (await pickChatSyncTargets(20)).find(id => !seen.has(id));
  if (target === undefined) break;
  // Leave retryable jobs to the scheduler; never force incomplete work complete.
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
