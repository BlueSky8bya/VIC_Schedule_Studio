import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";
import d1NextTagCache from "@opennextjs/cloudflare/overrides/tag-cache/d1-next-tag-cache";

// unstable_cache + revalidatePath/Tag를 쓰므로 캐시(R2)·무효화 표(D1)·재생성 큐(DO)가 모두 필요하다.
// D1은 즉시 일관성이라 쓰기 직후 공개 화면이 옛 값을 내지 않는다(KV 태그 캐시는 최대 60초 늦음).
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  tagCache: d1NextTagCache,
  queue: doQueue
});
