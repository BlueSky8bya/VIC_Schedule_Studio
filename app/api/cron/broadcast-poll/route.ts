import { NextResponse } from "next/server";
import { recordLiveTick } from "@/lib/broadcast/session";
import { fetchSoopLive } from "@/lib/broadcast/soop";

// 방송 ON/OFF 백업 폴러 — 시청자 트래픽이 없을 때도(방문자 0명 새벽 방송 등) 방송 세션이
// 빠짐없이 열리고 닫히도록 Vercel cron이 주기적으로 친다. soop-live 라우트와 같은 기록기를 호출.
// 시청자 폴링이 1차 신호, 이건 빈 구간을 메우는 백업(특히 뱅종 확정).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Vercel cron은 CRON_SECRET이 있으면 Authorization: Bearer <secret>로 호출한다. 설정돼 있으면 검증.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }
  const state = await fetchSoopLive();
  await recordLiveTick({ isLive: state.isLive, title: state.title, bno: state.bno });
  return NextResponse.json({ ok: true, isLive: state.isLive });
}
