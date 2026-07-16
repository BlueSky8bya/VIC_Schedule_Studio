import { createServerClient } from "@supabase/ssr";
import type { SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.next({
      request
    });
  }

  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, options, value }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  await supabase.auth.getUser();

  return response;
}

// 미들웨어가 하는 일은 '탐색 가능한 페이지'의 인증 쿠키 갱신(getUser)뿐이다. 그런데 matcher가
// /api/* 를 전부 먹고 있어서, 25초마다 도는 비콘 두 개(use-soop-live의 /api/soop-live,
// presence-beacon의 /api/presence)까지 매번 GoTrue를 왕복시켰다 — 동접 200이면 초당 ~16건이
// 아무도 안 읽는 사용자 조회에 쓰인다. 아래 셋은 쿠키 갱신이 필요 없다:
//   · /api/soop-live  — 완전 공개(액터 안 읽음)
//   · /api/presence   — 액터가 필요한 start는 액션 내부에서 직접 확인한다(권한면 불변)
//   · /api/public/*   — 공개 경계. 공개 로더만 쓴다
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/soop-live|api/presence|api/public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
