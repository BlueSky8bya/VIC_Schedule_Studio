import { cookies } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { getCurrentAuthSessionId, getCurrentSupabaseUser } from "@/lib/auth/server";
import { verifyPasscode } from "@/lib/private-layer/passcode";
import { UNLOCK_GRANT_COOKIE, hashGrantToken } from "@/lib/private-layer/unlock-grant";

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

  // P0-PRIV-2(L8): 잠금해제는 계정 전역(unlock_sessions)이 아니라 **grant 쿠키 + auth 세션
  // 결속**으로 판정한다. 쿠키의 opaque 토큰(sha256 해시 대조)과 현재 브라우저 auth 세션의
  // session_id가 모두 일치해야 열림 — 같은 계정이라도 다른 기기/브라우저는 각자 비밀번호 입력.
  // grant 쿠키만 다른 세션에 복사해도 session_id 불일치로 실패한다.
  const nowIso = new Date().toISOString();
  const cookieStore = await cookies();
  const grantToken = cookieStore.get(UNLOCK_GRANT_COOKIE)?.value ?? "";
  const [settingsRes, grantRes, authSessionId] = await Promise.all([
    supabase
      .from("private_layer_settings")
      .select("passcode_version, passcode_hash")
      .eq("calendar_id", calendar.id)
      .maybeSingle(),
    grantToken
      ? supabase
          .from("private_unlock_grants")
          .select("user_id, calendar_id, auth_session_id, passcode_version, expires_at")
          .eq("token_hash", hashGrantToken(grantToken))
          .gt("expires_at", nowIso)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    getCurrentAuthSessionId()
  ]);

  const settings = settingsRes.data;
  if (!settings) {
    return { passcodeSet: false, hasUnlockSession: false, isDefaultPasscode: false };
  }

  const grant = grantRes.data;
  const hasUnlockSession = Boolean(
    grant &&
      grant.user_id === user.id &&
      grant.calendar_id === calendar.id &&
      grant.passcode_version === settings.passcode_version &&
      authSessionId &&
      grant.auth_session_id === authSessionId
  );

  // [dev 진단 — 잠금 미스터리 해결까지 유지] 판정 실패 시 어느 고리가 끊겼는지.
  if (process.env.NODE_ENV === "development" && !hasUnlockSession) {
    console.log("[unlock-debug] state", {
      cookie: grantToken ? "yes" : "no",
      grantRow: grant ? "found" : "none",
      verMatch: grant ? grant.passcode_version === settings.passcode_version : null,
      sessionMatch: grant ? grant.auth_session_id === authSessionId : null
    });
  }

  return {
    passcodeSet: true,
    hasUnlockSession,
    // 버전이 아니라 "현재 해시가 0219인지"로 판별 — 0219를 변경 폼으로 설정해 버전이 올라가도 정확.
    isDefaultPasscode: verifyPasscode(DEFAULT_PASSCODE, settings.passcode_hash)
  };
}
