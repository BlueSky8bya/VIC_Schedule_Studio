"use server";

import { recordActivity } from "@/lib/activity/record";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { safeActionError } from "@/lib/utils/safe-action-error";

export type HopeResult = { ok: true; count: number } | { ok: false; error: string };

const SLUG = "vic";

// 최초공개(떡밥) '기대돼요' 토글 — 공개 전까지만 서버가 허용한다(0060 함수가 검증).
// 로그인 여부와 무관하게 기기 토큰 1기기 1표(익명 하트와 같은 vic:anonId 재사용, PII 비저장).
export async function toggleTeaserHopeAction(eventId: string, token: string): Promise<HopeResult> {
  if (!token || token.length < 8) {
    return { ok: false, error: "기기 식별자가 없습니다." };
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }
  const { data, error } = await supabase.rpc("toggle_teaser_hope", {
    p_event_id: eventId,
    p_token: token
  });
  if (error) {
    return { ok: false, error: safeActionError("기대 반영", error) };
  }
  // 어떤 떡밥이 기대를 모으는지 — 기기 토큰은 남기지 않는다.
  await recordActivity({ kind: "hope.toggle", target: eventId });
  return { ok: true, count: Number(data) };
}

// 이 기기가 기대를 눌러둔 일정 id — '내가 눌렀는지' 채움 상태 복원용.
export async function getTeaserHopeIdsAction(token: string): Promise<string[]> {
  if (!token || token.length < 8) {
    return [];
  }
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [];
  }
  const { data: calendar } = await supabase
    .from("calendars")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (!calendar) {
    return [];
  }
  const { data, error } = await supabase.rpc("get_teaser_hope_ids", {
    p_calendar_id: calendar.id,
    p_token: token
  });
  if (error || !data) {
    return [];
  }
  return (data as { event_id: string }[]).map((r) => r.event_id);
}
