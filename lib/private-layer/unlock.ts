import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { getCurrentSupabaseUser } from "@/lib/auth/server";

export type UnlockState = {
  passcodeSet: boolean;
  hasUnlockSession: boolean;
  // 현재 비밀번호 버전(기본 1=초기/미변경, 2+=관리자가 한 번이라도 바꿈). 없으면 null.
  passcodeVersion: number | null;
};

// 현재 사용자가 비공개 레이어 잠금을 해제한 세션이 있는지, 비밀번호가 설정돼 있는지.
// unlock_sessions / private_layer_settings는 RLS 정책이 없어 admin(service_role)로만 접근한다.
export async function getUnlockState(calendarSlug: string): Promise<UnlockState> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { passcodeSet: false, hasUnlockSession: false, passcodeVersion: null };
  }

  const user = await getCurrentSupabaseUser();
  if (!user) {
    return { passcodeSet: false, hasUnlockSession: false, passcodeVersion: null };
  }

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id")
    .eq("slug", calendarSlug)
    .maybeSingle();

  if (!calendar) {
    return { passcodeSet: false, hasUnlockSession: false, passcodeVersion: null };
  }

  const { data: settings } = await supabase
    .from("private_layer_settings")
    .select("passcode_version")
    .eq("calendar_id", calendar.id)
    .maybeSingle();

  if (!settings) {
    return { passcodeSet: false, hasUnlockSession: false, passcodeVersion: null };
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
    passcodeVersion: settings.passcode_version
  };
}
