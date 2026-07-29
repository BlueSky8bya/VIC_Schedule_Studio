import { redirect } from "next/navigation";

// P2-ROUTE-1: 태그 관리의 정본은 편집실의 '태그 편집' 모달 하나다. 이 라우트는 옛 북마크용
// 리다이렉트만 남긴다(플레이스홀더 페이지가 실제 기능처럼 보이던 문제 제거).
export default function TagsPage() {
  redirect("/studio?panel=tags");
}
