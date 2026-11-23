import { z } from "zod";
import type { PublicVodEntry } from "@/lib/domain/schedule-types";
import { groupVodsByDay } from "@/lib/schedules/vod-days";

/** 날짜 칸에 놓인 다시보기 — daySec = 그날 칸에서 열 때 시작할 지점(며칠 걸친 방송의 둘째 날부터). */
export type PublicVodDay = PublicVodEntry & { daySec?: number };

const vod = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  titleNo: z.number().int().positive(), title: z.string(), durationMs: z.number().finite().nonnegative(),
  chapters: z.number().int().nonnegative().optional(), timelineBy: z.string().optional(),
  thumbQuery: z.string().optional(), thumbUrl: z.string().optional(),
  host: z.string().optional(), hostId: z.string().optional(),
  access: z.enum(["sub", "plus"]).optional(), startedAt: z.string().optional(), broadcastNo: z.number().int().positive().optional()
});
const metadata = z.object({ vods: z.array(vod) });

/** Per-calendar, success-only cache. Failures release the next user retry. */
export function createPublicVodCache(slug: string, fetcher: typeof fetch = fetch) {
  let cached: Map<string, PublicVodDay[]> | null = null;
  let pending: Promise<Map<string, PublicVodDay[]>> | null = null;
  let controller: AbortController | null = null;
  let generation = 0;
  return {
    load(): Promise<Map<string, PublicVodDay[]>> {
      if (cached) return Promise.resolve(cached);
      if (pending) return pending;
      const serial = generation, ownController = new AbortController();
      controller = ownController;
      const own = (async () => {
        const res = await fetcher(`/api/public/${encodeURIComponent(slug)}/events`, { signal: ownController.signal });
        if (!res.ok) throw Error("Public replay metadata unavailable");
        const { vods } = metadata.parse(await res.json());
        // 달력 칸과 같은 날짜 규칙(오전 6시 경계, 며칠 걸친 방송은 걸친 날마다).
        const map: Map<string, PublicVodDay[]> = groupVodsByDay(vods);
        if (serial === generation) cached = map;
        return map;
      })();
      pending = own;
      void own.finally(() => {
        if (pending === own) { pending = null; controller = null; }
      }).catch(() => {});
      return own;
    },
    cancel() { generation++; controller?.abort(); controller = null; pending = null; }
  };
}
