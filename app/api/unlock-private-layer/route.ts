import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { getCurrentAuthSessionId, getCurrentSupabaseUser } from "@/lib/auth/server";
import { canUsePrivateLayer } from "@/lib/permissions/roles";
import { verifyPasscode } from "@/lib/private-layer/passcode";
import {
  UNLOCK_GRANT_COOKIE,
  grantCookieOptions,
  hashGrantToken,
  newGrantToken
} from "@/lib/private-layer/unlock-grant";

const SLUG = "vic";
// 무차별 대입 방어(P0-PRIV-2): 최근 10분 실패 5회 이상이면 잠시 차단.
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

// 비공개 레이어 잠금해제: 비밀번호 확인 → 현재 사용자 세션 발급.
// owner/developer/worker만 가능(매니저·시청자 불가 — 매니저는 비공개를 못 본다).
export async function POST(request: Request) {
  const actor = await resolveCurrentActor(SLUG);

  if (!actor.isAuthenticated || !canUsePrivateLayer(actor.role, actor.isWorker === true)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const user = await getCurrentSupabaseUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    passcode?: string;
    verifyOnly?: boolean;
  };
  const passcode = String(body.passcode ?? "");
  // verifyOnly: 비밀번호가 맞는지 검증만 하고 grant/쿠키는 발급하지 않는다.
  // 편집실의 최초공개(떡밥) 일정 게이트가 쓴다 — 게이트 통과가 비공개 레이어 잠금해제로
  // 번지지 않게 한다. 무차별 대입 방어(시도 기록·차단)는 동일하게 적용된다.
  const verifyOnly = body.verifyOnly === true;
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

  // P0-PRIV-2: 무차별 대입 방어 — 최근 10분 실패 횟수 확인(성공 전에 먼저 본다).
  const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MS).toISOString();
  const { count: failCount } = await supabase
    .from("private_unlock_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("ok", false)
    .gte("created_at", windowStart);
  if ((failCount ?? 0) >= MAX_FAILED_ATTEMPTS) {
    return NextResponse.json(
      { error: "시도가 너무 많아요. 10분 뒤 다시 시도해 주세요." },
      { status: 429 }
    );
  }

  // [임시 · 제거 예정] 최초공개 게이트 디자인 확인용 테스트 비번 — 환경변수가 설정된
  // 환경에서만, verifyOnly(검증 전용) 경로에서만 통한다. 실제 잠금해제(grant 발급)에는
  // 절대 못 쓴다. 확인 끝나면 이 분기와 .env.local의 TEASER_GATE_TEST_PASSCODE를 지울 것.
  const testPass = (process.env.TEASER_GATE_TEST_PASSCODE ?? "").trim();
  const passOk =
    verifyPasscode(passcode, settings.passcode_hash) ||
    (verifyOnly && testPass.length > 0 && passcode.trim() === testPass);
  // 시도 기록(성공/실패) + 창 밖 옛 기록 청소(지나가며 정리 — 별도 크론 불필요).
  await Promise.all([
    supabase.from("private_unlock_attempts").insert({ user_id: user.id, ok: passOk }),
    supabase.from("private_unlock_attempts").delete().lt("created_at", windowStart)
  ]);
  if (!passOk) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  if (verifyOnly) {
    return NextResponse.json({ ok: true });
  }

  // P0-PRIV-2(L8): grant는 이 브라우저의 auth 세션에 결속 — 같은 계정의 다른 기기는 안 열린다.
  const authSessionId = await getCurrentAuthSessionId();
  if (!authSessionId) {
    return NextResponse.json({ error: "로그인 세션을 확인할 수 없습니다." }, { status: 401 });
  }

  const durationMs = settings.unlock_duration_minutes * 60 * 1000;
  const expiresAt = new Date(Date.now() + durationMs).toISOString();
  const token = newGrantToken();

  // 이 auth 세션의 기존 grant 정리 후 새 grant 발급(세션당 1개).
  await supabase
    .from("private_unlock_grants")
    .delete()
    .eq("calendar_id", calendar.id)
    .eq("user_id", user.id)
    .eq("auth_session_id", authSessionId);

  const { error } = await supabase.from("private_unlock_grants").insert({
    token_hash: hashGrantToken(token),
    user_id: user.id,
    calendar_id: calendar.id,
    auth_session_id: authSessionId,
    passcode_version: settings.passcode_version,
    expires_at: expiresAt
  });

  if (error) {
    // P0-SEC-3: DB 원문 메시지는 서버 로그로만 — 클라이언트에는 일반 안내만.
    console.error("[api-fail] 비공개 레이어 잠금 해제:", error);
    return NextResponse.json(
      { error: "잠금 해제에 실패했어요. 잠시 후 다시 시도해 주세요." },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ ok: true, expiresAt });
  // opaque 토큰은 HttpOnly 쿠키에만 — JS로 못 읽고, 응답 본문에도 안 싣는다.
  res.cookies.set(UNLOCK_GRANT_COOKIE, token, grantCookieOptions(Math.floor(durationMs / 1000)));
  return res;
}
