import { NextResponse } from "next/server";
import { recordLiveTick } from "@/lib/broadcast/session";
import { fetchSoopLive } from "@/lib/broadcast/soop";
import { syncVodArchive } from "@/lib/broadcast/vod-archive";
import {
  minutesSinceLastBroadcastEnd,
  pickTimelineSyncTargets,
  syncVodTimelines
} from "@/lib/broadcast/vod-timeline";

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
  await recordLiveTick({
    isLive: state.isLive,
    title: state.title,
    bno: state.bno,
    startedAt: state.startedAt
  });
  // 다시보기 아카이브(0068)·팬 타임라인(0071) 증분 동기화 — 오프라인일 때만(방송 중엔 확정 전).
  // 두 단 주기(2026-08-31 사용자 요청 — 타임라인이 보통 뱅종 5분 안에 올라온다):
  //  · 뱅종 후 60분 안 = 고속 창: 5분마다 VOD 1페이지 + 최신 타임라인 3개 → 최악 10분 안에 반영
  //  · 그 외 = 평시: 30분마다 VOD 1페이지 + 최근 14일 타임라인 8개(팬의 나중 수정도 이 스윕이 흡수)
  let vodSynced = false;
  let timelinesSynced = 0;
  if (!state.isLive) {
    const min = new Date().getUTCMinutes();
    const sinceEnd = await minutesSinceLastBroadcastEnd();
    const hot = sinceEnd !== null && sinceEnd <= 60;
    if (hot ? min % 5 === 0 : min % 30 === 0) {
      vodSynced = (await syncVodArchive(1)).ok;
      timelinesSynced = (
        await syncVodTimelines(await pickTimelineSyncTargets(hot ? 3 : 8, hot ? 2 : 14))
      ).saved;
    }
  }
  return NextResponse.json({ ok: true, isLive: state.isLive, vodSynced, timelinesSynced });
}
