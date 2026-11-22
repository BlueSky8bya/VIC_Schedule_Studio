import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/auth/cron-auth";
import { runHealthCheck } from "@/lib/health/check";

// 고장 점검(0173) — DB의 pg_cron이 6시간마다 부른다. Workers 예약 작업(매시)도 같은 점검을 부르므로,
// 어느 한쪽 예약 작업이 멈춰도 다른 쪽이 알림을 보낼 수 있다. ?test=1 은 시험 메일 한 통(같은 인증).
// 응답에는 알림 종류 이름만 싣는다(메일 주소·내용 없음) — pg_net 응답 기록에서 결과를 확인할 수 있다.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isCronAuthorized(req))) return NextResponse.json({ ok: false }, { status: 401 });
  const test = new URL(req.url).searchParams.get("test") === "1";
  const result = await runHealthCheck({ test }).catch(() => ({ ok: false, alerts: [], sent: [], mail: "failed" as const, error: "threw" }));
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
