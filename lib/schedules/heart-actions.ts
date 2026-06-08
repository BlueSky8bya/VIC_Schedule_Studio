"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";

export type HeartResult = { ok: true; count: number } | { ok: false; error: string };

const SLUG = "vic";

// A(집계형 인기 표시): 한 일정의 관심(하트)을 토글한다. 새 집계 수(계정+익명 합산)를 돌려준다.
// 로그인 사용자는 계정 1인 1하트(user_id), 비로그인은 기기 토큰 1하트(device_token) — 구글 로그인
// 장벽 없이도 시청자가 관심을 표시할 수 있게 한다. 공개 안전(user_id/token 비노출).
export async function toggleEventHeartAction(
  eventId: string,
  token?: string
): Promise<HeartResult> {
  const actor = await resolveCurrentActor(SLUG);
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  // 로그인 사용자 → 계정 기반(위조 불가). 비로그인 → 기기 토큰 기반(클라가 보낸 익명 식별자).
  if (actor.isAuthenticated) {
    const { data, error } = await supabase.rpc("toggle_event_heart", {
      p_event_id: eventId
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, count: Number(data) };
  }

  if (!token || token.length < 8) {
    return { ok: false, error: "기기 식별자가 없습니다." };
  }
  const { data, error } = await supabase.rpc("toggle_event_heart_anon", {
    p_event_id: eventId,
    p_token: token
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, count: Number(data) };
}

// 비로그인(기기 토큰)이 이 캘린더에서 하트한 공개 일정 id — '내 하트' 채움 상태 복원용.
export async function getAnonHeartIdsAction(token: string): Promise<string[]> {
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
  const { data, error } = await supabase.rpc("get_anon_heart_ids", {
    p_calendar_id: calendar.id,
    p_token: token
  });
  if (error || !data) {
    return [];
  }
  return (data as { event_id: string }[]).map((r) => r.event_id);
}
