import { headers } from "next/headers";
import { CalendarSkeleton } from "@/components/skeleton/calendar-skeleton";
import { LegalLoading } from "@/components/legal/legal-doc";
import { LEGAL_PATHS, VIC_PATH_HEADER } from "@/lib/ui/request-path";
import { resolveLoadingTarget } from "@/lib/ui/loading-variant";

// 루트(/) 로딩. 역할 + 시청자 미리보기 여부에 맞춰 배경/문구를 고른다(첫 로그인 포함).
// 자세한 규칙은 resolveLoadingTarget 참고.
// 개인정보처리방침·이용약관으로 가는 길이면 문서 틀을 보인다 — 루트 로딩은 모든 최상위 이동의 경계라, 달력에서
// 문서 링크를 누르면 이 화면이 먼저 떠 "편집실" 뼈대가 보였다(2026-11-13 소유자). 목적지는 미들웨어가 넣는 헤더로 안다.
export default async function Loading() {
  const path = (await headers()).get(VIC_PATH_HEADER) ?? "";
  if (LEGAL_PATHS.has(path)) return <LegalLoading />;
  const { variant, label } = await resolveLoadingTarget();
  return <CalendarSkeleton variant={variant} label={label} />;
}
