import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/server";

const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

// "로그아웃": 현재 세션을 끊고 익명 상태로 루트(/)에 머무른다.
// 익명도 공개 포스터를 볼 수 있으므로 로그인 화면으로 튕기지 않는다. 계정을 바꾸려면
// 익명 상태에서 다시 "로그인"(prompt=select_account)을 누르면 된다.
export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new Error("unavailable");
    // Local scope preserves other devices. Auth errors can leave this session's
    // cookies intact, so only a successful sign-out receives the redirect.
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw new Error("unavailable");
    return NextResponse.redirect(new URL("/", request.url), { status: 303, headers });
  } catch {
    return NextResponse.json({ error: "logout_unavailable" }, { status: 503, headers });
  }
}
