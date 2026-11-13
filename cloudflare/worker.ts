// Cloudflare Worker 진입점: OpenNext가 만든 Next 핸들러에 예약 작업(scheduled)만 덧붙인다.
// 1분마다 방송 확인(시청자 없을 때의 백업 폴러). GitHub Actions 5분 폴러를 대신한다(2026-11-13).
// 빌드 산출물(.open-next)은 `opennextjs-cloudflare build` 뒤에만 생긴다(tsconfig에서 제외, wrangler esbuild가 묶음).
import handler from "../.open-next/worker.js";
import { serveWithAnonHomeCache } from "../lib/edge/anon-home-cache";

type Env = { CRON_SECRET?: string; NEXT_PUBLIC_SITE_URL?: string };
type Ctx = { waitUntil(p: Promise<unknown>): void; passThroughOnException?(): void };

const CRON_ROUTES: Record<string, string> = {
  "* * * * *": "/api/cron/broadcast-poll",
  // 연간 인사이트 아카이브(1/1 KST부터 지난해)·원본 통계 정리(다음 해 2/1부터) — lib/insights/archive.ts.
  "7 * * * *": "/api/cron/insights-archive"
};

const worker = {
  // 익명 `/`만 짧게 캐시한다(규칙·이유: lib/edge/anon-home-cache.ts). 나머지 요청은 그대로 Next로.
  fetch(request: Request, env: Env, ctx: Ctx) {
    const cache = (caches as unknown as { default: { match(k: string): Promise<Response | undefined>; put(k: string, r: Response): Promise<void> } }).default;
    return serveWithAnonHomeCache(request, ctx, (req) => handler.fetch(req, env, ctx), cache);
  },

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

export default worker;

// OpenNext 캐시 재생성 큐(Durable Object)를 Worker에서 내보내야 바인딩이 잡힌다.
export { DOQueueHandler } from "../.open-next/worker.js";
