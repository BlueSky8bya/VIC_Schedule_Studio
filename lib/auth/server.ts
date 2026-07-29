import { createServerClient } from "@supabase/ssr";
import type { SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/auth/config";

export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          try {
            cookiesToSet.forEach(({ name, options, value }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // 서버 컴포넌트는 항상 쿠키를 설정할 수 있는 건 아니다. 미들웨어가 쿠키를 갱신한다.
          }
        }
      }
    }
  );
}

// auth.getUser()는 Supabase Auth 서버로의 네트워크 왕복이라 느리다. 한 요청(렌더) 안에서
// 여러 곳(페이지·로더·언락 확인)이 호출해도 React cache로 단 한 번만 실행되게 묶는다.
export const getCurrentSupabaseUser = cache(async () => {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user;
});

// 현재 브라우저 auth 세션의 session_id claim(P0-PRIV-2 잠금해제 grant 결속용).
// getSession()은 쿠키의 JWT를 로컬 파싱만 하지만, 실제 사용자 검증은 항상
// getCurrentSupabaseUser()(서버 왕복)와 짝으로 쓰므로 결속 값 추출 용도로는 충분하다.
export const getCurrentAuthSessionId = cache(async (): Promise<string | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const {
    data: { session }
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return null;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8")) as {
      session_id?: string;
    };
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
});
