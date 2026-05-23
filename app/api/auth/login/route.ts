import { NextResponse } from "next/server";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/auth/config";
import { createSupabaseServerClient } from "@/lib/auth/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const next = sanitizeNextPath(String(formData.get("next") ?? "/"));
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", next);

  if (!isSupabaseConfigured()) {
    loginUrl.searchParams.set("error", "Supabase 환경 변수가 설정되지 않았습니다.");
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase!.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        access_type: "offline",
        prompt: "select_account"
      }
    }
  });

  if (error || !data.url) {
    loginUrl.searchParams.set(
      "error",
      error?.message ?? "Google 로그인 URL을 만들 수 없습니다."
    );
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  return NextResponse.redirect(data.url, { status: 303 });
}

function sanitizeNextPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
