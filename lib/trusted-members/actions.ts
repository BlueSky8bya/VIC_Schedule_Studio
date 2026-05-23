"use server";

import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { normalizeEmail } from "@/lib/auth/config";
import { canEditSchedule } from "@/lib/permissions/roles";

const SLUG = "vic";

export type TrustedMember = {
  id: string;
  email: string;
  displayName: string | null;
  trustedRole: "manager" | "worker";
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
    .select("id, email, display_name, trusted_role, is_active")
    .eq("calendar_id", calId)
    .order("created_at");
  return (data ?? []).map((m) => ({
    id: m.id,
    email: m.email,
    displayName: m.display_name,
    trustedRole: m.trusted_role as "manager" | "worker",
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

export async function addTrustedMemberAction(
  email: string,
  trustedRole: "manager" | "worker"
): Promise<MemberResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 추가할 수 있습니다." };
  }
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) {
    return { ok: false, error: "이메일을 입력하세요." };
  }
  if (trustedRole !== "manager" && trustedRole !== "worker") {
    return { ok: false, error: "역할이 올바르지 않습니다." };
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
      trusted_role: trustedRole,
      can_view_embargo: true,
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
    return { ok: false, error: "owner 또는 developer만 삭제할 수 있습니다." };
  }
  const supabase = createSupabaseAdminClient();
  const calId = await calendarId(supabase);
  if (!supabase || !calId) {
    return { ok: false, error: "Supabase 설정 또는 캘린더를 찾을 수 없습니다." };
  }
  const { error } = await supabase.from("trusted_members").delete().eq("id", id);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, members: await list(supabase, calId) };
}
