import { CalendarSkeleton } from "@/components/skeleton/calendar-skeleton";
import { resolveCurrentActor } from "@/lib/auth/actor";

// 루트(/) 로딩. 역할에 따라 목적지가 갈린다: 개발자·소유자·작업자/매니저는 편집실로,
// 일반 시청자는 일정표로 간다 → 로딩 배경/문구도 그에 맞춘다(첫 로그인 포함).
//
// resolveCurrentActor는 React cache()로 묶여 있어 page.tsx와 같은 요청에서 한 번만
// 조회된다(여기서 먼저 불러도 추가 왕복 없음). 그래서 역할별 로딩을 공짜로 그릴 수 있다.
//
// studio 세그먼트에는 loading.tsx를 두지 않는다 — `/`→`/studio/decorate` 이동 때 중간
// "편집실" 로딩이 깜빡였다가 "꾸미기"로 바뀌던 문제를 없앤다(이제 꾸미기 leaf 로딩만 뜬다).
export default async function Loading() {
  const actor = await resolveCurrentActor("vic");
  const studio = actor.isAuthenticated && actor.role !== "viewer";
  return (
    <CalendarSkeleton
      variant={studio ? "studio" : "poster"}
      label={studio ? "편집실" : "빅토리 일정표"}
    />
  );
}
