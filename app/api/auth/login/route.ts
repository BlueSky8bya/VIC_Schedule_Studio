import { NextResponse } from "next/server";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/auth/config";
import { createSupabaseServerClient } from "@/lib/auth/server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const next = sanitizeNextPath(String(formData.get("next") ?? "/"));

  return startGoogleOAuth(request, next);
}

// GET 진입 — 안드로이드 웹뷰 탈출 시 크롬이 이 URL을 열면 /login 카드(HTML)를 렌더하지 않고
// 곧장 구글 OAuth로 302 리다이렉트한다(계정 선택창 바로 노출). next는 쿼리에서 읽는다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = sanitizeNextPath(url.searchParams.get("next") ?? "/");

  return startGoogleOAuth(request, next);
}

async function startGoogleOAuth(request: Request, next: string) {
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
