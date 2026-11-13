import { redirect } from "next/navigation";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { listReports } from "@/lib/reports/report";
import { ReportsBoard } from "@/components/studio/reports-board";

// 사이트 제보함(0167) — **개발자 전용**. 문서 페이지의 제보 창으로 들어온 버그·일정 오류·아이디어·기타.
// 처리 완료로 표시하면 90일 뒤 자동 삭제된다(개인정보처리방침과 같은 기준). 설정 모달의 개발자 탭 '사이트 제보함 → 열기'에서 온다.
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const actor = await resolveCurrentActor("vic");
  if (actor.role !== "developer") redirect("/studio");
  const rows = await listReports();
  return <ReportsBoard error={rows ? null : "제보를 불러오지 못했어요."} rows={rows ?? []} />;
}
