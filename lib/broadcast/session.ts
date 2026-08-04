import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { fetchSoopBroadStart, fetchSoopVodTimes } from "@/lib/broadcast/soop";

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

type OpenRow = {
  id: string;
  started_at: string;
  last_live_at: string;
  bno: string | null;
  start_verified: boolean;
};

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
  // 라이브 응답이 직접 알려준 실제 시작 시각(BTIME 기반). 있으면 이걸 정답으로 쓴다.
  startedAt?: string | null;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return;
  try {
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const { data: openRows } = await supabase
      .from("broadcast_session")
      .select("id, started_at, last_live_at, bno, start_verified")
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
          const patch: {
            last_live_at: string;
            bno?: string;
            started_at?: string;
            start_day?: string;
            start_verified?: boolean;
          } =
            open.bno === null && bno !== null
              ? { last_live_at: nowIso, bno }
              : { last_live_at: nowIso };
          if (!open.start_verified) {
            // 시작시각이 아직 폴링-폴백값이면 실제 시작시각으로 머리를 보정한다.
            // insert 순간 실패했어도 여기서 tick마다 재시도하고, 성공하면 verified로
            // 굳혀 이후 호출을 멈춘다(2026-08-02 머리 10분 손실의 재발 방지 — 0059).
            // 1순위는 이번 응답의 BTIME(추가 요청 0), 안 되면 검색 API 폴백.
            const broadStart = state.startedAt ?? (await fetchSoopBroadStart(bno ?? open.bno));
            if (broadStart) {
              patch.start_verified = true;
              if (new Date(broadStart).getTime() < new Date(open.started_at).getTime()) {
                patch.started_at = broadStart;
                patch.start_day = kstDay(new Date(broadStart).getTime());
              }
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
      // 새 세션의 시작시각은 '지금(첫 발견 시점)'이 아니라 실제 방송 시작시각을 우선한다.
      // 폴링은 시청자가 포스터를 열어야 도니, 뱅온 후 첫 시청자가 올 때까지의 시간이 통째로
      // 누락돼 방송시간이 실제보다 짧게 집계되던 원인(머리 손실). 둘 다 실패하면 지금으로 폴백.
      const broadStart = state.startedAt ?? (await fetchSoopBroadStart(bno));
      const startedIso = broadStart ?? nowIso;
      const { error: insertError } = await supabase.from("broadcast_session").insert({
        start_day: kstDay(new Date(startedIso).getTime()),
        started_at: startedIso,
        last_live_at: nowIso,
        bno,
        title: state.title ?? null,
        // API 실패 시 false로 남겨, 이후 라이브 tick에서 머리 보정을 재시도한다(0059).
        start_verified: broadStart !== null
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

    // offline — 열린 세션을 닫는다. 종료시각은 다시보기(VOD)의 정답값을 우선한다:
    // 마지막 폴링(last_live_at) 이후 뱅종까지의 꼬리가 통째로 깎이던 손실을 VOD의
    // reg_date(≈실제 뱅종)·길이로 보정하고, 시작도 'VOD 등록 − 길이'로 정밀화한다
    // (더 이른 시각일 때만 — 방송 중 잠깐 열어본 폴링보다 정확). VOD가 아직 안 올라왔거나
    // 실패하면 예전처럼 last_live_at으로 보수적 종료(다음 offline 폴링은 열린 세션이
    // 없어 이 경로에 다시 안 들어온다 — 그 한 번의 기회에 최선을 다한다).
    if (open) {
      const vod = open.bno !== null ? await fetchSoopVodTimes(open.bno) : null;
      const lastLiveMs = new Date(open.last_live_at).getTime();
      const patch: {
        ended_at: string;
        last_live_at?: string;
        started_at?: string;
        start_day?: string;
        vod_verified?: boolean;
        start_verified?: boolean;
      } = { ended_at: open.last_live_at };
      if (vod && new Date(vod.endedAt).getTime() >= lastLiveMs) {
        patch.ended_at = vod.endedAt;
        patch.last_live_at = vod.endedAt;
        patch.vod_verified = true;
        const vodStartMs = new Date(vod.startedAt).getTime();
        if (vodStartMs < new Date(open.started_at).getTime()) {
          patch.started_at = vod.startedAt;
          patch.start_day = kstDay(vodStartMs);
          patch.start_verified = true;
        }
      }
      await supabase.from("broadcast_session").update(patch).eq("id", open.id);
      return;
    }

    // 열린 세션이 없어도 끝이 아니다 — 방금 닫힌 세션의 꼬리를 VOD로 재보정한다(0059).
    // VOD는 방종 후 몇 분 있다가 등록되므로, 위의 '닫는 순간' 조회는 거의 항상 놓친다
    // (2026-08-02 꼬리 7분 손실). 최근에 닫혔고 아직 VOD 보정을 못 받은 세션을 오프라인
    // tick마다 재시도하고, 성공하면 verified로 굳혀 이후 호출을 멈춘다.
    // 창을 6h → 48h로 넓혔다: 백업 폴러(GitHub Actions)의 실효 간격이 5분이 아니라 2시간대라
    // (GH 스케줄 스로틀) 6시간 창 안에 재시도 기회가 몇 번 없었고, 시청자가 없는 새벽 방종은
    // 그대로 꼬리가 깎인 채 굳었다. VOD 목록은 최근 20건이라 48시간은 안전하게 커버된다.
    const retryAfterIso = new Date(nowMs - 48 * 3600 * 1000).toISOString();
    const { data: closedRows } = await supabase
      .from("broadcast_session")
      .select("id, started_at, last_live_at, bno")
      .not("ended_at", "is", null)
      .eq("vod_verified", false)
      .not("bno", "is", null)
      .gte("last_live_at", retryAfterIso)
      .order("last_live_at", { ascending: false })
      .limit(1);
    const closed = closedRows?.[0] ?? null;
    if (closed?.bno) {
      const vod = await fetchSoopVodTimes(closed.bno);
      if (vod && new Date(vod.endedAt).getTime() >= new Date(closed.last_live_at).getTime()) {
        const patch: {
          ended_at: string;
          last_live_at: string;
          vod_verified: boolean;
          started_at?: string;
          start_day?: string;
          start_verified?: boolean;
        } = { ended_at: vod.endedAt, last_live_at: vod.endedAt, vod_verified: true };
        const vodStartMs = new Date(vod.startedAt).getTime();
        if (vodStartMs < new Date(closed.started_at).getTime()) {
          patch.started_at = vod.startedAt;
          patch.start_day = kstDay(vodStartMs);
          patch.start_verified = true;
        }
        await supabase.from("broadcast_session").update(patch).eq("id", closed.id);
      }
    }
  } catch {
    // 진단용 부가 기록 — 실패해도 조용히 넘어간다(시청자 응답·방송에 영향 없음).
  }
}
