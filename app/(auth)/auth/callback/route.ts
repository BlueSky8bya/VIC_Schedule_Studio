import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = sanitizeNextPath(requestUrl.searchParams.get("next") ?? "/");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = (await supabase?.auth.exchangeCodeForSession(code)) ?? {};

    if (error) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", `로그인 세션 교환 실패: ${error.message}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}

function sanitizeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
