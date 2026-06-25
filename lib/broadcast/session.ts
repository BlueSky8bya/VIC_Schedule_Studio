import { createSupabaseAdminClient } from "@/lib/auth/admin";

// 방송 ON/OFF 세션 기록기 — soop-live 라우트(시청자 폴링)와 백업 cron이 매 폴링마다 호출한다.
// 라이브 상태 전이를 broadcast_session에 한 줄로 적재한다(시작→종료 1세션). 절대 응답을 막지 않게
// fire-and-forget(try/catch로 삼킴)으로 부른다. 단일 스트리머 앱이라 전역 1행 흐름(calendar_id 없음).

const KST_MS = 9 * 3600 * 1000;

// 라이브가 끊긴 듯 보여도 이 시간 안에 다시 잡히면 같은 방송으로 잇는다 — 시청자 폴링은 방문자가
// 없으면 비는데, 그 빈 구간 때문에 연속 방송이 쪼개져 총 시간이 깎이는 걸 막는다(과소집계 방지).
// 이보다 더 벌어진 뒤의 라이브는 새 방송으로 본다(예: 어제 방송이 안 닫힌 채 오늘 다시 켬).
const SESSION_GAP_MS = 4 * 3600 * 1000;

function kstDay(ms: number): string {
  return new Date(ms + KST_MS).toISOString().slice(0, 10);
}

type OpenRow = { id: string; started_at: string; last_live_at: string };

// 매 폴링 1회. live면 열린 세션을 잇거나(없으면) 새로 열고, offline이면 열린 세션을 last_live_at에서 닫는다.
// 종료시각을 '감지 시점'이 아니라 '마지막 라이브 확인 시각(last_live_at)'으로 잡아, 폴링이 늦거나
// 비어도 방송시간이 부풀지 않게 한다(보수적 추정).
export async function recordLiveTick(state: { isLive: boolean; title?: string | null }): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;
  try {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const { data: openRows } = await supabase
      .from("broadcast_session")
      .select("id, started_at, last_live_at")
      .is("ended_at", null)
      .order("last_live_at", { ascending: false })
      .limit(1);
    const open = (openRows?.[0] ?? null) as OpenRow | null;

    if (state.isLive) {
      if (open) {
        const gap = nowMs - new Date(open.last_live_at).getTime();
        if (gap <= SESSION_GAP_MS) {
          // 같은 방송 — 마지막 라이브 시각만 끌어올린다.
          await supabase
            .from("broadcast_session")
            .update({ last_live_at: nowIso })
            .eq("id", open.id);
          return;
        }
        // 너무 오래 비었음 → 이전 방송을 마지막 라이브에서 닫고 새 방송을 연다.
        await supabase
          .from("broadcast_session")
          .update({ ended_at: open.last_live_at })
          .eq("id", open.id);
      }
      await supabase.from("broadcast_session").insert({
        start_day: kstDay(nowMs),
        started_at: nowIso,
        last_live_at: nowIso,
        title: state.title ?? null
      });
      return;
    }

    // offline — 열린 세션이 있으면 마지막 라이브 확인 시각에서 종료 확정.
    if (open) {
      await supabase
        .from("broadcast_session")
        .update({ ended_at: open.last_live_at })
        .eq("id", open.id);
    }
  } catch {
    // 진단용 부가 기록 — 실패해도 조용히 넘어간다(시청자 응답·방송에 영향 없음).
  }
}
