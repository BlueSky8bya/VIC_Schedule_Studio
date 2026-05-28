import { CalendarSkeleton } from "@/components/skeleton/calendar-skeleton";

// 루트(/) 로딩: actor·역할·일정이 풀릴 때까지 즉시 달력 뼈대를 보여준다.
// 시청자가 채팅 링크로 들어오는 핵심 경로 — 빈 화면 응시를 없앤다. 공개 안전만 렌더.
export default function Loading() {
  return <CalendarSkeleton variant="poster" />;
}
