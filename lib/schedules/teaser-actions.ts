"use server";

import { loadRevealedEvents } from "@/lib/schedules/public-loader";
import type { TeaserRevealResult } from "@/lib/schedules/teaser-reconcile";

const SLUG = "vic";

// 떡밥 즉시 공개 — 카운트다운이 0이 되면 클라(시청자 포스터)가 호출한다. 캐시를 거치지 않고 DB를
// 직접 읽어, 공개 시각이 지난 일정의 실제 내용만 돌려준다(서버가 reveal 시각 강제 확인 → 유출 0).
// 결과는 {ok, events} — ok=false는 '확인 실패', ok=true+없음은 '그 일정은 이제 없다'(삭제/비공개
// 전환)다. 클라는 후자에서만 유령 카드를 지운다(reconcileTeaserReveal).
export async function revealTeaserAction(eventIds: string[]): Promise<TeaserRevealResult> {
  return loadRevealedEvents(SLUG, eventIds);
}
