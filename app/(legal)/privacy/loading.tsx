import { LegalLoading } from "@/components/legal/legal-loading";
import { LEGAL_TITLES } from "@/lib/ui/request-path";

// 개인정보처리방침 전용 로딩 — 정적 페이지라 경로 헤더를 읽지 못하므로 목적지 이름을 고정으로 둔다.
export default function Loading() {
  return <LegalLoading label={LEGAL_TITLES["/privacy"]} />;
}
