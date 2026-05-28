import { CalendarSkeleton } from "@/components/skeleton/calendar-skeleton";
import { resolveLoadingTarget } from "@/lib/ui/loading-variant";

// /studio(편집실 index) 전용 로딩. (home) 라우트 그룹에 둬서 decorate와 경계를 공유하지 않는다 →
// 꾸미기에서 "편집실로 가기"로 돌아올 때 (home)이 새로 마운트되며 이 로딩이 확실히 뜬다(서버
// 재조회를 가린다). 동시에 `/`→`/studio/decorate` 이동 때 "편집실" 중간 깜빡임은 생기지 않는다.
export default async function Loading() {
  const { variant, label } = await resolveLoadingTarget();
  return <CalendarSkeleton variant={variant} label={label} />;
}
