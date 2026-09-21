import { NextResponse } from "next/server";
import { pickChatSyncTargets, syncVodChat } from "@/lib/broadcast/vod-chat";
import { createSupabaseAdminClient } from "@/lib/auth/admin";

// 다시보기 채팅 단어 수집(0088) — 백필·수동 실행용 크론 라우트.
// Independent scheduled queue for new archives, missing chunks and late timeline context.
// GitHub Actions invokes this even while live: GET /api/cron/vod-chat?limit=4&chunks=120
// CRON_SECRET과 Bearer 인증이 필수(broadcast-poll과 같은 규약). 원문·닉은 저장하지 않는다.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const url = new URL(req.url);
  const number = (key: string, fallback: number, max: number) => {
    const n = Number(url.searchParams.get(key) ?? fallback);
    return Number.isFinite(n) ? Math.max(1, Math.min(max, Math.floor(n))) : fallback;
  };
  const limit = number("limit", 2, 10);
  const chunks = number("chunks", 60, 150);
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
        const { error } = await supabase.rpc(fn).abortSignal(AbortSignal.timeout(5000));
        if (error) console.warn(`[vod-chat] ${fn} failed:`, error.message);
      }
    }
  }
  return NextResponse.json({ ...result, targets });
}
