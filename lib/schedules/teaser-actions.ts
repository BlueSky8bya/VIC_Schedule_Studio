"use server";

import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { revalidateEventHeartCounts } from "@/lib/schedules/cache";
import { loadRevealedEvents } from "@/lib/schedules/public-loader";
import type { TeaserRevealResult } from "@/lib/schedules/teaser-reconcile";

const SLUG = "vic";

// 떡밥 즉시 공개 — 카운트다운이 0이 되면 클라(시청자 포스터)가 호출한다. 캐시를 거치지 않고 DB를
// 직접 읽어, 공개 시각이 지난 일정의 실제 내용만 돌려준다(서버가 reveal 시각 강제 확인 → 유출 0).
// 결과는 {ok, events} — ok=false는 '확인 실패', ok=true+없음은 '그 일정은 이제 없다'(삭제/비공개
// 전환)다. 클라는 후자에서만 유령 카드를 지운다(reconcileTeaserReveal).
export async function revealTeaserAction(eventIds: string[]): Promise<TeaserRevealResult> {
  const result = await loadRevealedEvents(SLUG, eventIds);
  // 공개된 떡밥의 비로그인 '기대돼요'를 하트로 옮긴다(0140) — 응답 전에 끝내야 클라가 곧바로 받는
  // 하트 목록에 들어 있다. 실패해도 공개는 막지 않는다(pg_cron 5분 그물이 다시 줍는다).
  const revealed = result.ok ? result.events.filter((ev) => !ev.teaser).map((ev) => ev.id) : [];
  if (revealed.length > 0) {
    try {
      const admin = createSupabaseAdminClient();
      const { data } = (await admin?.rpc("settle_teaser_hopes", { p_event_ids: revealed })) ?? {};
      if (Number(data) > 0) revalidateEventHeartCounts();
    } catch {
      /* 보조 동작 */
    }
  }
  return result;
}
