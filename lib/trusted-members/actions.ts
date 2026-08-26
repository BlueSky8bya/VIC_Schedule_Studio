"use server";

import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { canEditSchedule } from "@/lib/permissions/roles";
import { normalizeEmail } from "@/lib/auth/config";

const SLUG = "vic";

// 신뢰 멤버 = 매니저 한 종류(2026-08-27, ADR-0015 — 작업자 역할 철수). DB의 is_manager/trusted_role은
// 항상 manager로 기록한다(is_worker 컬럼·enum 'worker' 값은 0065 마이그레이션에서 정리).
export type TrustedMember = {
  id: string;
  email: string;
  displayName: string | null;
  isActive: boolean;
};

export type MemberResult =
  | { ok: true; members: TrustedMember[] }
  | { ok: false; error: string };

async function calendarId(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  if (!supabase) return null;
  const { data } = await supabase.from("calendars").select("id").eq("slug", SLUG).maybeSingle();
  return data?.id ?? null;
}

async function list(supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>, calId: string) {
  const { data } = await supabase
    .from("trusted_members")
    .select("id, email, display_name, is_active")
    .eq("calendar_id", calId)
    .order("created_at");
  return (data ?? []).map((m) => ({
    id: m.id,
    email: m.email,
    displayName: m.display_name,
    isActive: m.is_active
  }));
}

export async function listTrustedMembersAction(): Promise<MemberResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 볼 수 있습니다." };
  }
  const supabase = createSupabaseAdminClient();
  const calId = await calendarId(supabase);
  if (!supabase || !calId) {
    return { ok: false, error: "Supabase 설정 또는 캘린더를 찾을 수 없습니다." };
  }
  return { ok: true, members: await list(supabase, calId) };
}

// 매니저 추가(이미 있으면 활성으로 되살림). 역할은 하나뿐이라 인자가 이메일뿐이다.
export async function addTrustedManagerAction(email: string): Promise<MemberResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 관리할 수 있습니다." };
  }
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) {
    return { ok: false, error: "이메일을 입력하세요." };
  }

  const supabase = createSupabaseAdminClient();
  const calId = await calendarId(supabase);
  if (!supabase || !calId) {
    return { ok: false, error: "Supabase 설정 또는 캘린더를 찾을 수 없습니다." };
  }

  const { error } = await supabase.from("trusted_members").upsert(
    {
      calendar_id: calId,
      email: cleanEmail,
      is_manager: true,
      trusted_role: "manager",
      // P0-PRIV-3: can_view_embargo는 어떤 RLS/로더도 읽지 않는 죽은 플래그 — 엠바고는 소유자 전용
      // (ADR-0012)이므로 오해 소지를 없애기 위해 false로 고정.
      can_view_embargo: false,
      can_view_work: true,
      is_active: true,
      updated_at: new Date().toISOString()
    },
    { onConflict: "calendar_id,email" }
  );
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, members: await list(supabase, calId) };
}

export async function removeTrustedMemberAction(id: string): Promise<MemberResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 관리할 수 있습니다." };
  }
  const supabase = createSupabaseAdminClient();
  const calId = await calendarId(supabase);
  if (!supabase || !calId) {
    return { ok: false, error: "Supabase 설정 또는 캘린더를 찾을 수 없습니다." };
  }
  const { error } = await supabase
    .from("trusted_members")
    .delete()
    .eq("id", id)
    .eq("calendar_id", calId);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, members: await list(supabase, calId) };
}
