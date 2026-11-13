import { LegalLoading } from "@/components/legal/legal-doc";

// 개인정보처리방침·이용약관 전용 로딩. 루트 로딩(app/loading.tsx)은 역할에 따라 편집실/달력 뼈대를 그려
// 문서로 가는 중에도 "편집실" 화면이 떴다(2026-11-13 소유자 지적) — 이 묶음은 문서 틀만 먼저 보여 준다.
export default function Loading() {
  return <LegalLoading />;
}
