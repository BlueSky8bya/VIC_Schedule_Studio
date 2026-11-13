import { headers } from "next/headers";
import { LegalLoading } from "@/components/legal/legal-loading";
import { RouteLoading } from "@/components/shared/route-loading";
import { LEGAL_TITLES, VIC_PATH_HEADER } from "@/lib/ui/request-path";
import { resolveLoadingTarget } from "@/lib/ui/loading-variant";

// 루트(/) 로딩. 역할 + 시청자 미리보기 여부에 맞춰 배경/문구를 고른다(첫 로그인 포함).
// 자세한 규칙은 resolveLoadingTarget 참고.
// 개인정보처리방침·이용약관으로 가는 길이면 문서 로딩을 보인다 — 루트 로딩은 모든 최상위 이동의 경계라, 달력에서
// 문서 링크를 누르면 이 화면이 먼저 떠 "편집실" 뼈대가 보였다(2026-11-13 소유자). 새로 열 때는 미들웨어가 넣는 경로 헤더로,
// 화면 이동 중에는 RouteLoading이 주소로 안다. 문구는 목적지 이름 + 뛰는 토리(2026-11-14 소유자).
export default async function Loading() {
  const path = (await headers()).get(VIC_PATH_HEADER) ?? "";
  const legal = LEGAL_TITLES[path];
  if (legal) return <LegalLoading label={legal} />;
  const { variant, label } = await resolveLoadingTarget();
  return <RouteLoading label={label} variant={variant} />;
}
