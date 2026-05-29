import { CalendarSkeleton } from "@/components/skeleton/calendar-skeleton";
import { resolveLoadingTarget } from "@/lib/ui/loading-variant";

// 월 라우트(/studio/calendar/[year]/[month])는 북마크·콜드 진입·새로고침으로만 들어온다
// (런타임 월 이동은 클라이언트에서 처리). 콜드 진입 시 서버가 일정을 그리는 동안 흰 화면 대신
// 편집실/포스터 톤 스켈레톤을 즉시 보여준다(=home 로딩과 동일).
export default async function Loading() {
  const { variant, label } = await resolveLoadingTarget();
  return <CalendarSkeleton variant={variant} label={label} />;
}
