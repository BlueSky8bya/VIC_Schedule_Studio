import { NextResponse } from "next/server";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/auth/config";
import { createSupabaseServerClient } from "@/lib/auth/server";

// "계정 변경": 현재 세션을 끊고(빠르게 로컬만) 곧바로 구글 계정 선택창으로 보낸다.
// 우리 앱의 로그인 페이지(vercel.app)를 거치지 않게 한다.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  // scope: "local" — 서버 전역 폐기 네트워크 왕복을 생략해 빠르게 로컬 쿠키만 정리.
  await supabase?.auth.signOut({ scope: "local" });

  if (!supabase || !isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/", request.url), { status: 303 });
  }

  // 로그아웃 직후 바로 OAuth 시작 → 구글 계정 선택창(prompt=select_account)으로 이동.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent("/")}`,
      queryParams: {
        access_type: "offline",
        prompt: "select_account"
      }
    }
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/", request.url), { status: 303 });
  }

  return NextResponse.redirect(data.url, { status: 303 });
}
