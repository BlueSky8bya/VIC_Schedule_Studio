import { CalendarSkeleton } from "@/components/skeleton/calendar-skeleton";
import { resolveLoadingTarget } from "@/lib/ui/loading-variant";

// 루트(/) 로딩. 역할 + 시청자 미리보기 여부에 맞춰 배경/문구를 고른다(첫 로그인 포함).
// 자세한 규칙은 resolveLoadingTarget 참고.
export default async function Loading() {
  const { variant, label } = await resolveLoadingTarget();
  return <CalendarSkeleton variant={variant} label={label} />;
}
