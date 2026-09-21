"use server";

import { revalidatePath } from "next/cache";
import { recordActivity } from "@/lib/activity/record";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { canEditSchedule } from "@/lib/permissions/roles";
import { hashPasscode, verifyPasscode } from "@/lib/private-layer/passcode";
import { getCurrentSupabaseUser } from "@/lib/auth/server";
import { reservePasscodeAttempt } from "@/lib/private-layer/attempt-limit";

export type PasscodeResult = { ok: true } | { ok: false; error: string };
export type ClearUnlocksResult = { ok: true; cleared: number } | { ok: false; error: string };

const SLUG = "vic";

// (clearUnlockSessionsAction 삭제 — '열린 비공개 세션 전부 초기화'를 하려던 액션인데 이걸 부르는
//  화면이 없다. 즉 그 안전장치는 오늘 존재하지 않았다(있다고 착각하면 그게 더 위험하다). 아래
//  개별 만료(clearUnlockSessionForUserAction)는 보안 패널에서 실제로 쓰인다. 전체 초기화 버튼이
//  필요하면 그건 새 기능이다 — git 이력에 구현이 남아 있다.)


// owner/developer가 특정 한 사람의 비공개 잠금 세션만 즉시 만료한다(보안 패널 역할별 카드의 개별 만료).
export async function clearUnlockSessionForUserAction(userId: string): Promise<ClearUnlocksResult> {
  const actor = await resolveCurrentActor(SLUG);

  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "owner 또는 developer만 잠금 세션을 초기화할 수 있습니다." };
  }
  if (!userId) {
    return { ok: false, error: "대상 사용자가 없습니다." };
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

  // P0-PRIV-2: 이 사용자의 grant(세션 결속)를 전부 지운다 = '모든 세션' 잠그기(L8의 all-session
  // revoke는 보안 패널의 이 개별 만료가 담당). (legacy unlock_sessions는 0067에서 drop — 2026-08-27.)
  const { error } = await supabase
    .from("private_unlock_grants")
    .delete()
    .eq("calendar_id", calendar.id)
    .eq("user_id", userId);
  if (error) {
    console.error("[action-fail] 잠금 세션 초기화:", error);
    return { ok: false, error: "잠금 세션 초기화에 실패했어요. 잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/studio");

  return { ok: true, cleared: 1 };
}

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

  if (typeof newPasscode !== "string" || typeof currentPasscode !== "string" || newPasscode.length > 256 || currentPasscode.length > 256 || newPasscode.trim().length < 4) {
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

  const { data: existing, error: settingsError } = await supabase
    .from("private_layer_settings")
    .select("passcode_version, passcode_hash")
    .eq("calendar_id", calendar.id)
    .maybeSingle();

  if (settingsError) {
    return { ok: false, error: "비밀번호 설정을 확인할 수 없어요. 잠시 후 다시 시도해 주세요." };
  }

  const user = await getCurrentSupabaseUser();
  if (!user) return { ok: false, error: "로그인이 필요합니다." };
  const attempt = await reservePasscodeAttempt(supabase, user.id);
  if (attempt !== "allowed") return { ok: false, error: attempt === "limited"
    ? "시도가 너무 많아요. 10분 뒤 다시 시도해 주세요."
    : "비밀번호 확인을 사용할 수 없어요. 잠시 후 다시 시도해 주세요." };

  // 기존 비밀번호가 있으면 현재 비밀번호 검증
  if (existing && !verifyPasscode(currentPasscode, existing.passcode_hash)) {
    return { ok: false, error: "현재 비밀번호가 올바르지 않습니다." };
  }

  const nextVersion = existing ? existing.passcode_version + 1 : 1;
  const now = new Date().toISOString();

  const row = {
    calendar_id: calendar.id,
    passcode_hash: hashPasscode(newPasscode),
    passcode_version: nextVersion,
    passcode_updated_at: now,
    updated_at: now
  };
  // Compare-and-swap: a concurrent password change must not be overwritten using
  // a password/version checked before it. First setup uses INSERT, never upsert.
  const write = existing
    ? supabase.from("private_layer_settings").update(row)
        .eq("calendar_id", calendar.id)
        .eq("passcode_version", existing.passcode_version)
    : supabase.from("private_layer_settings").insert(row);
  const { data: saved, error } = await write.select("calendar_id").maybeSingle();

  if (error || !saved) {
    return { ok: false, error: "비밀번호를 변경하지 못했어요. 새로고침 후 다시 시도해 주세요." };
  }

  // 비밀번호가 바뀌면 기존 grant는 version 불일치로 자동 무효화되지만, 깔끔히 삭제한다.
  await supabase.from("private_unlock_grants").delete().eq("calendar_id", calendar.id);

  revalidatePath("/studio");

  // 비밀번호 자체는 당연히 남기지 않는다 — 바꿨다는 사실만.
  await recordActivity({ kind: "passcode.change" });

  return { ok: true };
}
