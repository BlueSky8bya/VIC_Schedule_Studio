import { redirect } from "next/navigation";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { canEditSchedule } from "@/lib/permissions/roles";
import { listReports, markReportsSeen } from "@/lib/reports/report";
import { gmailConfigured } from "@/lib/reports/gmail";
import { ReportsBoard } from "@/components/studio/reports-board";
import { REPORT_OWNER_VISIBLE_FROM } from "@/lib/reports/topics";

// 사이트 제보함(0167) — **관리자·개발자**(2026-11-23 소유자). 문서 페이지의 제보 창으로 들어온 버그·일정 오류·아이디어·기타.
// 처리 완료로 표시하면 90일 뒤, 아무도 처리하지 않아도 받은 지 180일 뒤 자동 삭제된다(개인정보처리방침과 같은 기준).
// 답장 보내기(개발자 문의 계정)는 개발자에게만 보인다.
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const actor = await resolveCurrentActor("vic");
  if (!canEditSchedule(actor.role)) redirect("/studio");
  // 관리자는 "방송인과 개발자에게 전달" 안내가 나간 뒤에 받은 제보만 본다(그 전 제보는 개발자만).
  const since = actor.role === "developer" ? undefined : REPORT_OWNER_VISIBLE_FROM;
  const rows = await listReports(since);
  // 이번에 처음 보는 제보는 '새 제보'로 표시하고, 열었으니 모두 '봄'으로(헤더 제보함 숫자가 0이 된다).
  const newIds = (rows ?? []).filter((r) => !r.seen_at).map((r) => r.id);
  if (newIds.length) await markReportsSeen(since);
  return <ReportsBoard error={rows ? null : "제보를 불러오지 못했어요."} canReply={actor.role === "developer"} mailReady={gmailConfigured()} newIds={newIds} rows={rows ?? []} />;
}
