import { NextResponse } from "next/server";
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
    const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? {};

    if (error) {
      // 날 것의 supabase 메시지를 URL에 노출하지 않는다 — 안정적인 코드만.
      return redirectToLogin(request, "exchange", next);
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
