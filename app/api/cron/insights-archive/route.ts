import { NextResponse } from "next/server";
import { runInsightsMaintenance } from "@/lib/insights/archive";

// 연간 인사이트 아카이브·원본 통계 정리(0160) — Workers Cron이 매시 부른다(wrangler.jsonc, cloudflare/worker.ts).
// 할 일이 없으면 아카이브 표 조회 몇 번으로 끝난다. 1월 1일(KST)부터 지난해를 채우고, 다음 해 2월 1일부터 원본을 지운다.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const report = await runInsightsMaintenance();
  return NextResponse.json({ ok: true, report });
}
