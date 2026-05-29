import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { getCurrentSupabaseUser } from "@/lib/auth/server";
import { verifyPasscode } from "@/lib/private-layer/passcode";

// 초기(기본) 비공개 비밀번호 — 변경 폼 placeholder가 "처음: 0219" 힌트를 띄울 기준.
// 관리자가 한 번이라도 다른 값으로 바꾸면 아래 isDefaultPasscode가 false가 되어 힌트가 사라진다.
const DEFAULT_PASSCODE = "0219";

export type UnlockState = {
  passcodeSet: boolean;
  hasUnlockSession: boolean;
  // 현재 비밀번호가 아직 초기값(0219)인지 — 변경 폼 placeholder 힌트용. 다른 값으로 바꾸면 false.
  isDefaultPasscode: boolean;
};

// 현재 사용자가 비공개 레이어 잠금을 해제한 세션이 있는지, 비밀번호가 설정돼 있는지.
// unlock_sessions / private_layer_settings는 RLS 정책이 없어 admin(service_role)로만 접근한다.
export async function getUnlockState(calendarSlug: string): Promise<UnlockState> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { passcodeSet: false, hasUnlockSession: false, isDefaultPasscode: false };
  }

  const user = await getCurrentSupabaseUser();
  if (!user) {
    return { passcodeSet: false, hasUnlockSession: false, isDefaultPasscode: false };
  }

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id")
    .eq("slug", calendarSlug)
    .maybeSingle();

  if (!calendar) {
    return { passcodeSet: false, hasUnlockSession: false, isDefaultPasscode: false };
  }

  const { data: settings } = await supabase
    .from("private_layer_settings")
    .select("passcode_version, passcode_hash")
    .eq("calendar_id", calendar.id)
    .maybeSingle();

  if (!settings) {
    return { passcodeSet: false, hasUnlockSession: false, isDefaultPasscode: false };
  }

  const { data: session } = await supabase
    .from("unlock_sessions")
    .select("id")
    .eq("calendar_id", calendar.id)
    .eq("user_id", user.id)
    .eq("passcode_version", settings.passcode_version)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return {
    passcodeSet: true,
    hasUnlockSession: Boolean(session),
    // 버전이 아니라 "현재 해시가 0219인지"로 판별 — 0219를 변경 폼으로 설정해 버전이 올라가도 정확.
    isDefaultPasscode: verifyPasscode(DEFAULT_PASSCODE, settings.passcode_hash)
  };
}
