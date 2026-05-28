import { cookies } from "next/headers";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { parseViewCookie, VIEW_COOKIE } from "@/lib/ui/view-cookie";

// 로딩 화면(loading.tsx)이 "어디로 가는지"에 맞춰 배경/문구를 고르게 한다.
// - 개발자·소유자·작업자/매니저 → 편집실 톤("편집실")
// - 일반 시청자 → 포스터 톤("빅토리 일정표")
// - 단, 스태프라도 시청자 화면 미리보기(v=1) 중이면 그 화면은 포스터라 포스터 톤으로.
//
// resolveCurrentActor는 React cache()라 page.tsx와 같은 요청에서 한 번만 조회된다(추가 왕복 없음).
export async function resolveLoadingTarget(): Promise<{
  variant: "studio" | "poster";
  label: string;
}> {
  const [actor, cookieStore] = await Promise.all([resolveCurrentActor("vic"), cookies()]);
  const mem = parseViewCookie(cookieStore.get(VIEW_COOKIE)?.value);
  const staff = actor.isAuthenticated && actor.role !== "viewer";
  const studio = staff && mem.v !== 1;
  return studio
    ? { variant: "studio", label: "편집실" }
    : { variant: "poster", label: "빅토리 일정표" };
}
