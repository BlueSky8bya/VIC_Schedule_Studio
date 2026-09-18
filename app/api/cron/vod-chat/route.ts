import { NextResponse } from "next/server";
import { pickChatSyncTargets, syncVodChat } from "@/lib/broadcast/vod-chat";
import { createSupabaseAdminClient } from "@/lib/auth/admin";

// 다시보기 채팅 단어 수집(0088) — 백필·수동 실행용 크론 라우트.
// 평시 증분은 broadcast-poll의 maybeSyncVodPipeline이 조금씩 받고, 옛 방송 수백 개를 채우는 백필은
// 이 라우트를 cron-job.org(또는 curl 반복)로 부른다: GET /api/cron/vod-chat?limit=3&chunks=60
// CRON_SECRET이 있으면 Bearer 검증(broadcast-poll과 같은 규약). 원문·닉은 저장하지 않는다.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });
  }
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(10, Number(url.searchParams.get("limit") ?? 2)));
  const chunks = Math.max(1, Math.min(150, Number(url.searchParams.get("chunks") ?? 60)));
  const targets = await pickChatSyncTargets(limit);
  const result = await syncVodChat(targets, chunks);
  // 새 단어가 들어왔으면 **가벼운 것만** 다시 배운다(조각을 실제로 받았을 때만).
  // ⚠ search_term_graph_rebuild는 여기서 부르지 않는다(2026-09-19): 최적화 뒤에도 63초라
  // 이 라우트의 maxDuration 60초를 넘겨, 채팅이 들어오는 날마다 크론이 통째로 타임아웃했다
  // (그 바람에 줄임말·요즘 말 갱신도 함께 죽고 있었다). 무거운 재빌드는 pg_cron이 밤에 돌린다
  // (db/migrations/0120, cron.job 'vic-search-graph' → public.search_graph_nightly()).
  if (result.chunks > 0) {
    const supabase = createSupabaseAdminClient();
    if (supabase) {
      for (const fn of ["search_synonyms_rebuild", "search_trending_rebuild"] as const) {
        const { error } = await supabase.rpc(fn);
        if (error) console.warn(`[vod-chat] ${fn} failed:`, error.message);
      }
    }
  }
  return NextResponse.json({ ...result, targets });
}
