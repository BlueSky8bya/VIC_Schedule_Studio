import { NextResponse } from "next/server";
import { recordLiveTick } from "@/lib/broadcast/session";
import { fetchSoopLive } from "@/lib/broadcast/soop";
import { syncVodArchive } from "@/lib/broadcast/vod-archive";
import { pickTimelineSyncTargets, syncVodTimelines } from "@/lib/broadcast/vod-timeline";

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
  // 다시보기 아카이브(0068) 증분 동기화 — 오프라인일 때 30분에 한 번(외부 크론이 1분 간격으로
  // 치는 걸 분 나머지로 걸러낸다). VOD는 뱅종 후 몇 분 안에 올라오므로 이 주기면 시청자 화면의
  // '다시보기' 칩이 뱅종 30분 안에 붙는다. 방송 중엔 VOD가 확정 전이라 건드리지 않는다.
  let vodSynced = false;
  let timelinesSynced = 0;
  if (!state.isLive && new Date().getUTCMinutes() % 30 === 0) {
    vodSynced = (await syncVodArchive(1)).ok;
    // 팬 타임라인(0071)도 이어서 — 최근 VOD의 타임라인은 며칠에 걸쳐 작성·수정되므로
    // 30분 주기마다 최근 14일치 중 오래된 순 8개를 다시 읽는다(요청 8회, 부담 미미).
    timelinesSynced = (await syncVodTimelines(await pickTimelineSyncTargets(8, 14))).saved;
  }
  return NextResponse.json({ ok: true, isLive: state.isLive, vodSynced, timelinesSynced });
}
