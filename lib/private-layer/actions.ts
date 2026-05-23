"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { canEditSchedule } from "@/lib/permissions/roles";
import { hashPasscode, verifyPasscode } from "@/lib/private-layer/passcode";

export type PasscodeResult = { ok: true } | { ok: false; error: string };

const SLUG = "vic";

// owner/developer가 비공개 레이어 비밀번호를 설정/변경한다.
// 기존 비밀번호가 있으면 현재 비밀번호를 검증한다. 변경 시 passcode_version을 올려
// 기존 잠금해제 세션을 모두 무효화한다.
export async function setPasscodeAction(
  newPasscode: string,
  currentPasscode = ""
): Promise<PasscodeResult> {
  const actor = await resolveCurrentActor(SLUG);

  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 비밀번호를 변경할 수 있습니다." };
  }

  if (newPasscode.trim().length < 4) {
    return { ok: false, error: "새 비밀번호는 4자 이상이어야 합니다." };
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase service role 키가 필요합니다." };
  }

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();

  if (!calendar) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }

  const { data: existing } = await supabase
    .from("private_layer_settings")
    .select("passcode_version, passcode_hash")
    .eq("calendar_id", calendar.id)
    .maybeSingle();

  // 기존 비밀번호가 있으면 현재 비밀번호 검증
  if (existing && !verifyPasscode(currentPasscode, existing.passcode_hash)) {
    return { ok: false, error: "현재 비밀번호가 올바르지 않습니다." };
  }

  const nextVersion = existing ? existing.passcode_version + 1 : 1;
  const now = new Date().toISOString();

  const { error } = await supabase.from("private_layer_settings").upsert(
    {
      calendar_id: calendar.id,
      passcode_hash: hashPasscode(newPasscode),
      passcode_version: nextVersion,
      passcode_updated_at: now,
      updated_at: now
    },
    { onConflict: "calendar_id" }
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  // 비밀번호가 바뀌면 기존 세션은 version 불일치로 자동 무효화되지만, 깔끔히 삭제한다.
  await supabase.from("unlock_sessions").delete().eq("calendar_id", calendar.id);

  revalidatePath("/studio");
  revalidatePath("/studio/private-layer");

  return { ok: true };
}
