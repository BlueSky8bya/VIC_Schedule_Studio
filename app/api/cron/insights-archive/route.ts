import { NextResponse } from "next/server";
import { runInsightsMaintenance } from "@/lib/insights/archive";
import { purgeExpiredReports } from "@/lib/reports/report";
import { runHealthCheck } from "@/lib/health/check";

// 연간 인사이트 아카이브·원본 통계 정리(0160)와 기한 지난 사이트 제보 삭제(0167) — Workers Cron이 매시 부른다(wrangler.jsonc, cloudflare/worker.ts).
// 할 일이 없으면 아카이브 표 조회 몇 번으로 끝난다. 1월 1일(KST)부터 지난해를 채우고, 다음 해 2월 1일부터 원본을 지운다.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const report = await runInsightsMaintenance();
  // 같은 시간별 작업에서 처리 완료 후 90일(처리 전이어도 받은 지 180일)이 지난 사이트 제보(0167)를 파일까지 지운다 — 개인정보처리방침의 보관 기간.
  const reports = await purgeExpiredReports();
  // 고장 점검(0173) — 문제가 새로 생겼을 때만 개발자에게 메일 한 통. 점검이 실패해도 위 작업 결과는 그대로 돌려준다.
  const health = await runHealthCheck().catch(() => ({ ok: false, alerts: [], sent: [], mail: "failed" as const }));
  return NextResponse.json({ ok: true, report, reports, health });
}
