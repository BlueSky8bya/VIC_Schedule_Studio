import { cookies } from "next/headers";
import { LOADING_TONE_COOKIE, parseViewCookie, VIEW_COOKIE } from "@/lib/ui/view-cookie";

// 로딩 화면(loading.tsx)이 "어디로 가는지"에 맞춰 배경/문구를 고르게 한다.
// - 개발자·소유자·작업자/매니저 → 편집실 톤("편집실")
// - 일반 시청자 → 포스터 톤("빅토리 일정표")
// - 단, 스태프라도 시청자 화면 미리보기(v=1) 중이면 그 화면은 포스터라 포스터 톤으로.
//
// ⚠ 여기서 resolveCurrentActor를 부르지 않는다. actor는 GoTrue 네트워크 왕복이라, 로딩
// 스켈레톤이 그걸 기다리면 "본문 기다리는 동안 즉시 뜨는 화면"이라는 존재 이유가 사라진다
// (콜드 엔트리에서 흰 화면이 길어진 주범이었다). 대신 편집실/포스터가 마운트 때 심어 두는
// 톤 힌트 쿠키(vic_lt)만 읽는다 — 쿠키 판독은 0ms고, 힌트가 없거나 낡아도 배경/문구가
// 잠깐 다를 뿐 권한·데이터와 무관하다(실제 분기는 page가 actor로 확정).
export async function resolveLoadingTarget(): Promise<{
  variant: "studio" | "poster";
  label: string;
}> {
  const cookieStore = await cookies();
  const mem = parseViewCookie(cookieStore.get(VIEW_COOKIE)?.value);
  const staffHint = cookieStore.get(LOADING_TONE_COOKIE)?.value === "s";
  const studio = staffHint && mem.v !== 1;
  return studio
    ? { variant: "studio", label: "편집실" }
    : { variant: "poster", label: "빅토리 일정표" };
}
