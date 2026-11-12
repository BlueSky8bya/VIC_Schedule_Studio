// Cloudflare Worker 진입점: OpenNext가 만든 Next 핸들러에 예약 작업(scheduled)만 덧붙인다.
// 1분마다 방송 확인(시청자 없을 때의 백업 폴러). GitHub Actions 5분 폴러를 대신한다(2026-11-13).
// 빌드 산출물(.open-next)은 `opennextjs-cloudflare build` 뒤에만 생긴다(tsconfig에서 제외, wrangler esbuild가 묶음).
import handler from "../.open-next/worker.js";

type Env = { CRON_SECRET?: string; NEXT_PUBLIC_SITE_URL?: string };

const CRON_ROUTES: Record<string, string> = {
  "* * * * *": "/api/cron/broadcast-poll"
};

export default {
  fetch: handler.fetch,

  async scheduled(controller: { cron: string }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    const path = CRON_ROUTES[controller.cron];
    const secret = env.CRON_SECRET?.trim();
    if (!path || !secret) return;
    const origin = env.NEXT_PUBLIC_SITE_URL ?? "https://victory-broadcast.com";
    const request = new Request(new URL(path, origin), {
      headers: { authorization: `Bearer ${secret}` }
    });
    ctx.waitUntil(handler.fetch(request, env, ctx));
  }
};

// OpenNext 캐시 재생성 큐(Durable Object)를 Worker에서 내보내야 바인딩이 잡힌다.
export { DOQueueHandler } from "../.open-next/worker.js";
