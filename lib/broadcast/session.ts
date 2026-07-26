import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { fetchSoopBroadStart } from "@/lib/broadcast/soop";

// 방송 ON/OFF 세션 기록기 — soop-live 라우트(시청자 폴링)와 백업 cron이 매 폴링마다 호출한다.
// 라이브 상태 전이를 broadcast_session에 한 줄로 적재한다(시작→종료 1세션). 절대 응답을 막지 않게
// fire-and-forget(try/catch로 삼킴)으로 부른다. 단일 스트리머 앱이라 전역 1행 흐름(calendar_id 없음).

const KST_MS = 9 * 3600 * 1000;

// bno를 모를 때(레거시 행/조회 실패)만 쓰는 폴백 간격. 라이브가 이 시간 안에 다시 잡히면 같은
// 방송으로 잇고, 더 벌어졌으면 새 방송으로 본다. ★ bno를 알면 이 값은 무시하고 bno로만 판정한다
// (폴링 공백에 연속 방송이 쪼개져 다음날로 오귀속되던 버그의 원인이 이 간격 판정이었다 — 0051).
const SESSION_GAP_MS = 4 * 3600 * 1000;

function kstDay(ms: number): string {
  return new Date(ms + KST_MS).toISOString().slice(0, 10);
}

type OpenRow = { id: string; started_at: string; last_live_at: string; bno: string | null };

// 매 폴링 1회. live면 열린 세션을 잇거나(없으면) 새로 열고, offline이면 열린 세션을 last_live_at에서 닫는다.
// 종료시각을 '감지 시점'이 아니라 '마지막 라이브 확인 시각(last_live_at)'으로 잡아, 폴링이 늦거나
// 비어도 방송시간이 부풀지 않게 한다(보수적 추정).
//
// 연속성 판정(0051): SOOP BNO(방송번호)를 정답값으로 쓴다. bno가 같으면 폴링이 아무리 비어도 같은
// 방송으로 이어 붙이고(그 공백도 라이브로 인정 — 같은 bno면 그 사이 계속 방송 중이었다는 뜻), bno가
// 다르면 새 방송으로 쪼갠다. 양쪽 bno를 모를 때만 예전 간격 휴리스틱으로 폴백한다.
export async function recordLiveTick(state: {
  isLive: boolean;
  title?: string | null;
  bno?: string | null;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;
  try {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const { data: openRows } = await supabase
      .from("broadcast_session")
      .select("id, started_at, last_live_at, bno")
      .is("ended_at", null)
      .order("last_live_at", { ascending: false })
      .limit(1);
    const open = (openRows?.[0] ?? null) as OpenRow | null;

    if (state.isLive) {
      const bno = state.bno ?? null;
      if (open) {
        // bno를 양쪽 다 알면 그걸로만 판정(정답값). 하나라도 모르면 간격 폴백.
        const continueSame =
          bno !== null && open.bno !== null
            ? open.bno === bno
            : nowMs - new Date(open.last_live_at).getTime() <= SESSION_GAP_MS;
        if (continueSame) {
          // 같은 방송 — 마지막 라이브 시각만 끌어올린다(같은 bno면 공백도 라이브로 인정돼 집계됨).
          // bno가 아직 비어 있던 열린 세션이면 이 참에 채워 넣어, 이후 판정을 정답값으로 승격한다.
          const patch: { last_live_at: string; bno?: string; started_at?: string; start_day?: string } =
            open.bno === null && bno !== null
              ? { last_live_at: nowIso, bno }
              : { last_live_at: nowIso };
          if (open.bno === null && bno !== null) {
            // bno를 처음 알게 된 순간, 방송국 API의 실제 시작시각으로 머리를 보정한다
            // (첫 폴링이 방송을 늦게 발견했으면 그 사이 시간이 통째로 깎여 있었다).
            const broadStart = await fetchSoopBroadStart(bno);
            if (broadStart && new Date(broadStart).getTime() < new Date(open.started_at).getTime()) {
              patch.started_at = broadStart;
              patch.start_day = kstDay(new Date(broadStart).getTime());
            }
          }
          await supabase.from("broadcast_session").update(patch).eq("id", open.id);
          return;
        }
        // 다른 방송(bno 다름) 또는 bno 불명 + 오래 빔 → 이전 방송을 마지막 라이브에서 닫고 새로 연다.
        await supabase
          .from("broadcast_session")
          .update({ ended_at: open.last_live_at })
          .eq("id", open.id);
      }
      // 새 세션의 시작시각은 '지금(첫 발견 시점)'이 아니라 방송국 API의 실제 방송 시작시각을
      // 우선한다. 폴링은 시청자가 포스터를 열어야 도니, 뱅온 후 첫 시청자가 올 때까지의 시간이
      // 통째로 누락돼 방송시간이 실제보다 짧게 집계되던 원인(머리 손실). API 실패 시 지금으로 폴백.
      const broadStart = await fetchSoopBroadStart(bno);
      const startedIso = broadStart ?? nowIso;
      const { error: insertError } = await supabase.from("broadcast_session").insert({
        start_day: kstDay(new Date(startedIso).getTime()),
        started_at: startedIso,
        last_live_at: nowIso,
        bno,
        title: state.title ?? null
      });
      // 동시 폴링 레이스로 같은 bno 행이 이미 있으면(unique index 0053에 충돌) 새로 만들지 않고
      // 그 행을 잇는다 — 닫혔던 행이면 다시 연다(같은 bno = 같은 방송이 계속 중이라는 뜻).
      if (insertError && bno !== null) {
        await supabase
          .from("broadcast_session")
          .update({ last_live_at: nowIso, ended_at: null })
          .eq("bno", bno);
      }
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
