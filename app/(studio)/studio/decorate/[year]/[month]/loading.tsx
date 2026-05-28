import { CalendarSkeleton } from "@/components/skeleton/calendar-skeleton";

// 꾸미기 로딩: 꾸미기는 시각적으로 풍부한 포스터 캔버스라, 포스터 뼈대를 즉시 보여준다.
// 꾸미기 도구·에셋 서랍은 권한이 서버에서 풀린 뒤에만 활성(스켈레톤엔 핸들 없음).
export default function Loading() {
  return <CalendarSkeleton variant="poster" label="꾸미기 화면" />;
}
