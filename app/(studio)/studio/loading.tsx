import { CalendarSkeleton } from "@/components/skeleton/calendar-skeleton";

// 스튜디오 로딩: 달력 + 편집 패널 자리의 뼈대를 즉시 보여준다.
// 편집 핸들·비공개 토글은 권한이 서버에서 풀린 뒤에만 나타난다(스켈레톤엔 없음).
export default function Loading() {
  return <CalendarSkeleton variant="studio" label="편집실" />;
}
