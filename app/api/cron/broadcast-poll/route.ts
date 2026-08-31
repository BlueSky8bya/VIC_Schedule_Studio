import { NextResponse } from "next/server";
import { recordLiveTick } from "@/lib/broadcast/session";
import { fetchSoopLive } from "@/lib/broadcast/soop";
import { maybeSyncVodPipeline } from "@/lib/broadcast/vod-timeline";

// 방송 ON/OFF 백업 폴러 — 시청자 트래픽이 없을 때도(방문자 0명 새벽 방송 등) 방송 세션이
// 빠짐없이 열리고 닫히도록 Vercel cron이 주기적으로 친다. soop-live 라우트와 같은 기록기를 호출.
// 시청자 폴링이 1차 신호, 이건 빈 구간을 메우는 백업(특히 뱅종 확정).
export const dynamic = "force-dynamic";
// Vercel(Hobby) 함수 기본 10초 — 평시 스윕(타임라인 8개 = 댓글 최대 16요청 + 간격)이 그 안에
// 못 끝나 도중에 죽을 수 있다(2026-09-01 prod에서 동기화가 하루 종일 0건이던 유력 원인).
export const maxDuration = 60;

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
  await recordLiveTick({
    isLive: state.isLive,
    title: state.title,
    bno: state.bno,
    startedAt: state.startedAt
  });
  // 다시보기·팬 타임라인 증분 — 단일 진입점(maybeSyncVodPipeline)이 DB 스로틀로 주기를 지킨다
  // (뱅종 30분 안 = 1분 / 60분 안 = 5분 / 평시 = 30분). 방송 중엔 안 돌린다(VOD 확정 전).
  // 결과를 응답에 실어 cron-job.org 실행 기록에서 육안 확인 가능하게 한다.
  const sync = state.isLive
    ? { ran: false, tier: "live", sinceEndMin: null as number | null }
    : await maybeSyncVodPipeline();
  return NextResponse.json({ ok: true, isLive: state.isLive, sync });
}
