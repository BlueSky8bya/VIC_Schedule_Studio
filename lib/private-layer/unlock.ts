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

  // user(Auth 서버 왕복)와 calendar(slug 조회)는 서로 의존이 없어 병렬로 받는다.
  const [user, calendarRes] = await Promise.all([
    getCurrentSupabaseUser(),
    supabase.from("calendars").select("id").eq("slug", calendarSlug).maybeSingle()
  ]);
  if (!user) {
    return { passcodeSet: false, hasUnlockSession: false, isDefaultPasscode: false };
  }
  const calendar = calendarRes.data;
  if (!calendar) {
    return { passcodeSet: false, hasUnlockSession: false, isDefaultPasscode: false };
  }

  // settings(비번)와 unlock 세션은 둘 다 calendar.id·user.id만 있으면 조회 가능 → 병렬.
  // 세션 유효성(현재 passcode_version 일치 + 미만료)은 settings를 받은 뒤 JS에서 판정한다.
  // (예전엔 settings.passcode_version을 SQL .eq로 걸어 session을 settings 뒤에 직렬로 기다렸다.)
  // — SQL .eq(passcode_version)/.gt(expires_at)와 완전히 동치라 비공개 게이트 동작은 그대로다.
  const nowIso = new Date().toISOString();
  const [settingsRes, sessionsRes] = await Promise.all([
    supabase
      .from("private_layer_settings")
      .select("passcode_version, passcode_hash")
      .eq("calendar_id", calendar.id)
      .maybeSingle(),
    supabase
      .from("unlock_sessions")
      .select("passcode_version, expires_at")
      .eq("calendar_id", calendar.id)
      .eq("user_id", user.id)
      .gt("expires_at", nowIso)
  ]);

  const settings = settingsRes.data;
  if (!settings) {
    return { passcodeSet: false, hasUnlockSession: false, isDefaultPasscode: false };
  }

  const hasUnlockSession = (sessionsRes.data ?? []).some(
    (s) => s.passcode_version === settings.passcode_version
  );

  return {
    passcodeSet: true,
    hasUnlockSession,
    // 버전이 아니라 "현재 해시가 0219인지"로 판별 — 0219를 변경 폼으로 설정해 버전이 올라가도 정확.
    isDefaultPasscode: verifyPasscode(DEFAULT_PASSCODE, settings.passcode_hash)
  };
}
