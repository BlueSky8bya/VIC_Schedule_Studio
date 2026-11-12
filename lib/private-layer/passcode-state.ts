import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { verifyPasscode } from "@/lib/private-layer/passcode";

// 초기(기본) 편집실 비밀번호 — 변경 폼 placeholder가 "처음: 0219" 힌트를 띄울 기준.
// 관리자가 한 번이라도 다른 값으로 바꾸면 아래 isDefaultPasscode가 false가 되어 힌트가 사라진다.
const DEFAULT_PASSCODE = "0219";

export type PasscodeState = {
  passcodeSet: boolean;
  // 현재 비밀번호가 아직 초기값(0219)인지 — 변경 폼 placeholder 힌트용. 다른 값으로 바꾸면 false.
  isDefaultPasscode: boolean;
};

// 최초공개 게이트 비밀번호가 설정돼 있는지, 아직 초기값인지. (잠금해제 세션·grant는 0159에서 철수 —
// 게이트는 카드를 열 때마다 비밀번호만 확인한다.) private_layer_settings는 RLS 정책이 없어
// admin(service_role)로만 읽는다.
export async function getPasscodeState(calendarSlug: string): Promise<PasscodeState> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { passcodeSet: false, isDefaultPasscode: false };

  const { data: calendar } = await supabase.from("calendars").select("id").eq("slug", calendarSlug).maybeSingle();
  if (!calendar) return { passcodeSet: false, isDefaultPasscode: false };

  const { data: settings } = await supabase
    .from("private_layer_settings")
    .select("passcode_hash")
    .eq("calendar_id", calendar.id)
    .maybeSingle();
  if (!settings) return { passcodeSet: false, isDefaultPasscode: false };

  // 버전이 아니라 "현재 해시가 0219인지"로 판별 — 0219를 변경 폼으로 설정해 버전이 올라가도 정확.
  return { passcodeSet: true, isDefaultPasscode: verifyPasscode(DEFAULT_PASSCODE, settings.passcode_hash) };
}
