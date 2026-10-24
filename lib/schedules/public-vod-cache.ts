import { z } from "zod";
import type { PublicVodEntry } from "@/lib/domain/schedule-types";

const vod = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  titleNo: z.number().int().positive(), title: z.string(), durationMs: z.number().finite().nonnegative(),
  chapters: z.number().int().nonnegative().optional(), timelineBy: z.string().optional(),
  thumbQuery: z.string().optional(), thumbUrl: z.string().optional(),
  host: z.string().optional(), hostId: z.string().optional(),
  access: z.enum(["sub", "plus"]).optional(), startedAt: z.string().optional()
});
const metadata = z.object({ vods: z.array(vod) });

/** Per-calendar, success-only cache. Failures release the next user retry. */
export function createPublicVodCache(slug: string, fetcher: typeof fetch = fetch) {
  let cached: Map<string, PublicVodEntry[]> | null = null;
  let pending: Promise<Map<string, PublicVodEntry[]>> | null = null;
  let controller: AbortController | null = null;
  let generation = 0;
  return {
    load(): Promise<Map<string, PublicVodEntry[]>> {
      if (cached) return Promise.resolve(cached);
      if (pending) return pending;
      const serial = generation, ownController = new AbortController();
      controller = ownController;
      const own = (async () => {
        const res = await fetcher(`/api/public/${encodeURIComponent(slug)}/events`, { signal: ownController.signal });
        if (!res.ok) throw Error("Public replay metadata unavailable");
        const { vods } = metadata.parse(await res.json());
        const map = new Map<string, PublicVodEntry[]>();
        for (const row of vods) {
          const list = map.get(row.dateKey) ?? []; list.push(row); map.set(row.dateKey, list);
        }
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
