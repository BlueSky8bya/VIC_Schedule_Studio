"use server";

import type { PublicScheduleEvent } from "@/lib/domain/schedule-types";
import { loadRevealedEvents } from "@/lib/schedules/public-loader";

const SLUG = "vic";

// 떡밥 즉시 공개 — 카운트다운이 0이 되면 클라(시청자 포스터)가 호출한다. 캐시를 거치지 않고 DB를
// 직접 읽어, 공개 시각이 지난 일정의 실제 내용만 돌려준다(서버가 reveal 시각 강제 확인 → 유출 0).
export async function revealTeaserAction(eventIds: string[]): Promise<PublicScheduleEvent[]> {
  return loadRevealedEvents(SLUG, eventIds);
}
