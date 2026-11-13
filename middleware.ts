import { createServerClient } from "@supabase/ssr";
import type { SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/auth/config";
import { guardedFetch } from "@/lib/net/guarded-fetch";
import { LEGAL_PATHS, VIC_PATH_HEADER } from "@/lib/ui/request-path";

// 요청 경로를 서버 컴포넌트(loading.tsx 등)에 헤더로 넘긴다. 쿠키 갱신 뒤에도 최신 쿠키 헤더를 실어야 하므로
// 매번 request.headers에서 새로 복사한다.
function passThrough(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(VIC_PATH_HEADER, request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export async function middleware(request: NextRequest) {
  // 고정 문서(개인정보처리방침·이용약관)는 로그인 상태를 읽지 않는 정적 페이지 — 인증 쿠키 갱신 왕복을 건너뛴다.
  if (!isSupabaseConfigured() || LEGAL_PATHS.has(request.nextUrl.pathname)) {
    return passThrough(request);
  }

  let response = passThrough(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: guardedFetch },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = passThrough(request);
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
// /api/* 를 전부 먹고 있어서, 60초마다 도는 비콘(use-soop-live의 /api/soop-live)까지 매번
// GoTrue를 왕복시켰다 — 아무도 안 읽는 사용자 조회다. 아래 둘은 쿠키 갱신이 필요 없다:
//   · /api/soop-live  — 완전 공개(액터 안 읽음)
//   · /api/public/*   — 공개 경계. 공개 로더만 쓴다
// (방문 비콘 /api/presence는 2026-11-13 철수.)
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/soop-live|api/public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
