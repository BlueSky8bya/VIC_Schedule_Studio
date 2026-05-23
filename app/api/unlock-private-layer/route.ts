import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { getCurrentSupabaseUser } from "@/lib/auth/server";
import { verifyPasscode } from "@/lib/private-layer/passcode";

const SLUG = "vic";

// 비공개 레이어 잠금해제: 비밀번호 확인 → 현재 사용자 세션 발급.
// owner/developer/manager/worker만 가능(시청자 불가). 비밀번호는 해시로만 비교한다.
export async function POST(request: Request) {
  const actor = await resolveCurrentActor(SLUG);

  if (actor.role === "viewer" || !actor.isAuthenticated) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const user = await getCurrentSupabaseUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { passcode?: string };
  const passcode = String(body.passcode ?? "");
  if (!passcode) {
    return NextResponse.json({ error: "비밀번호를 입력하세요." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase service role 키가 필요합니다." },
      { status: 500 }
    );
  }

  const { data: calendar } = await supabase
    .from("calendars")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();

  if (!calendar) {
    return NextResponse.json({ error: "캘린더를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: settings } = await supabase
    .from("private_layer_settings")
    .select("passcode_hash, passcode_version, unlock_duration_minutes")
    .eq("calendar_id", calendar.id)
    .maybeSingle();

  if (!settings) {
    return NextResponse.json(
      { error: "아직 비밀번호가 설정되지 않았습니다. owner가 먼저 설정해야 합니다." },
      { status: 409 }
    );
  }

  if (!verifyPasscode(passcode, settings.passcode_hash)) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const expiresAt = new Date(
    Date.now() + settings.unlock_duration_minutes * 60 * 1000
  ).toISOString();

  // 같은 사용자의 기존 세션 정리 후 새 세션 발급
  await supabase
    .from("unlock_sessions")
    .delete()
    .eq("calendar_id", calendar.id)
    .eq("user_id", user.id);

  const { error } = await supabase.from("unlock_sessions").insert({
    user_id: user.id,
    calendar_id: calendar.id,
    passcode_version: settings.passcode_version,
    expires_at: expiresAt
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, expiresAt });
}
