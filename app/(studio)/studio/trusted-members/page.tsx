import { redirect } from "next/navigation";

// P2-ROUTE-1: 멤버 관리의 정본은 편집실의 '멤버 관리' 모달 하나다. 이 페이지의 레거시 폼은
// 모달과 기능이 중복·낙후돼(비활성 계정 표시 없음 등) 혼란만 줬다 — 옛 북마크 리다이렉트만 유지.
export default function TrustedMembersPage() {
  redirect("/studio?panel=members");
}
