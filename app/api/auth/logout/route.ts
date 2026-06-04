import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/server";

// "로그아웃": 현재 세션을 끊고(빠르게 로컬 쿠키만) 익명 상태로 루트(/)에 머무른다.
// 익명도 공개 포스터를 볼 수 있으므로 로그인 화면으로 튕기지 않는다. 계정을 바꾸려면
// 익명 상태에서 다시 "로그인"(prompt=select_account)을 누르면 된다.
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  // scope: "local" — 서버 전역 폐기 네트워크 왕복을 생략해 빠르게 로컬 쿠키만 정리.
  await supabase?.auth.signOut({ scope: "local" });

  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
