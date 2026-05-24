"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseServerClient } from "@/lib/auth/server";

export type HeartResult = { ok: true; count: number } | { ok: false; error: string };

const SLUG = "vic";

// B2: 로그인한 시청자(또는 누구든 로그인 상태)가 하트 하나를 더한다. 누적 카운트를 돌려준다.
export async function addHeartAction(): Promise<HeartResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!actor.isAuthenticated) {
    return { ok: false, error: "로그인이 필요합니다." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (!calendar) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }

  const { data, error } = await supabase.rpc("add_calendar_heart", {
    p_calendar_id: calendar.id
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, count: Number(data) };
}

// A(집계형 인기 표시): 로그인 사용자가 한 일정의 관심(하트)을 토글한다.
// 1인 1하트 — 누르면 추가, 다시 누르면 해제. 새 집계 수를 돌려준다(공개 안전, user_id 비노출).
export async function toggleEventHeartAction(eventId: string): Promise<HeartResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!actor.isAuthenticated) {
    return { ok: false, error: "로그인이 필요합니다." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase가 설정되지 않았습니다." };
  }

  const { data, error } = await supabase.rpc("toggle_event_heart", {
    p_event_id: eventId
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, count: Number(data) };
}
