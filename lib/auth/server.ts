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
