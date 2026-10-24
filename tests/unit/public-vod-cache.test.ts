import { describe, expect, it, vi } from "vitest";
import { createPublicVodCache } from "@/lib/schedules/public-vod-cache";

const row = { dateKey: "2026-06-01", titleNo: 123, title: "공개 합성", durationMs: 3600000,
  access: "plus", host: "공개 호스트", hostId: "public-host", startedAt: "2026-06-01T20:00:00+09:00", chapters: 2,
  timelineBy: "공개 작성자", thumbQuery: "rowKey=123", thumbUrl: "https://stimg.sooplive.co.kr/1.jpg" };
const ok = (vods: unknown[] = [row]) => new Response(JSON.stringify({ vods }), { status: 200 });
describe("public replay metadata cache", () => {
  for (const [name, failure] of [
    ["HTTP503", () => Promise.resolve(new Response("{}", { status: 503 }))],
    ["network", () => Promise.reject(Error("offline"))],
    ["invalid JSON", () => Promise.resolve(new Response("not-json"))],
    ["missing VOD array", () => Promise.resolve(new Response("{}"))],
    ["invalid VOD row", () => Promise.resolve(ok([{ ...row, titleNo: "123" }]))]
  ] as const) {
    it(`allows a subsequent user retry after ${name}`, async () => {
      const fetcher = vi.fn().mockImplementationOnce(failure).mockResolvedValueOnce(ok());
      const cache = createPublicVodCache("vic", fetcher);
      await expect(cache.load()).rejects.toBeDefined();
      expect((await cache.load()).get(row.dateKey)?.[0]).toEqual(row);
      await cache.load(); expect(fetcher).toHaveBeenCalledTimes(2);
    });
  }
  it("coalesces in-flight reads and caches successful emptiness", async () => {
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(r => { resolve = r; }));
    const cache = createPublicVodCache("vic", fetcher), first = cache.load(), second = cache.load();
    expect(second).toBe(first); resolve(ok([])); expect((await first).size).toBe(0);
    await cache.load(); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not let cancelled old completion overwrite a fresh request/cache", async () => {
    const pending: ((value: Response) => void)[] = [];
    const fetcher = vi.fn(() => new Promise<Response>(r => pending.push(r)));
    const cache = createPublicVodCache("vic", fetcher), old = cache.load(); cache.cancel();
    const fresh = cache.load(); pending[0](ok([{ ...row, title: "old" }])); await old;
    expect(cache.load()).toBe(fresh); pending[1](ok([{ ...row, title: "fresh" }])); await fresh;
    expect((await cache.load()).get(row.dateKey)?.[0].title).toBe("fresh");
  });
  it("aborts the cancelled request and does not retain undeclared data", async () => {
    const fetcher = vi.fn().mockResolvedValue(ok([{ ...row, ownerPrivate: "MUST_NOT_COPY" }]));
    const cache = createPublicVodCache("public slug", fetcher);
    expect((await cache.load()).get(row.dateKey)?.[0]).not.toHaveProperty("ownerPrivate");
    cache.cancel(); expect(fetcher.mock.calls[0][0]).toBe("/api/public/public%20slug/events");
    // Settled requests need no abort; an in-flight cancellation does.
    let signal!: AbortSignal;
    const held = createPublicVodCache("vic", vi.fn((_url, init) => { signal = init!.signal as AbortSignal; return new Promise<Response>(() => {}); }));
    void held.load(); held.cancel(); expect(signal.aborted).toBe(true);
  });
});
