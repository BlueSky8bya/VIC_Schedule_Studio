import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/auth/server";
import { providerErrorToCode } from "@/lib/auth/auth-errors";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = sanitizeNextPath(requestUrl.searchParams.get("next") ?? "/");

  // 동의 화면에서 취소하면 code 없이 ?error=access_denied 로 돌아온다.
  // 예전엔 이 경우 그냥 앱으로 되돌려보내 "설명 없이 다시 로그인 화면"이 됐다 →
  // 친절한 코드로 로그인 화면에 안내한다.
  const providerError = requestUrl.searchParams.get("error");
  if (providerError) {
    return redirectToLogin(request, providerErrorToCode(providerError), next);
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? {};

    if (error) {
      // 날 것의 supabase 메시지를 URL에 노출하지 않는다 — 안정적인 코드만.
      return redirectToLogin(request, "exchange", next);
    }

    // 새 로그인(재로그인·계정변경 포함)은 비공개 잠금 세션을 초기화 — 방송 안전상 재로그인 시
    // 비밀번호를 다시 입력하게 한다. (정상 새로고침/토큰 갱신은 콜백을 안 거치므로 영향 없음.)
    const userId = data?.user?.id ?? data?.session?.user?.id;
    if (userId) {
      const admin = createSupabaseAdminClient();
      if (admin) {
        await admin.from("unlock_sessions").delete().eq("user_id", userId);
      }
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}

function redirectToLogin(request: Request, errorCode: string, next: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", errorCode);
  if (next && next !== "/") {
    loginUrl.searchParams.set("next", next);
  }
  return NextResponse.redirect(loginUrl);
}

function sanitizeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
