import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { admin } = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: admin }));
vi.mock("@/lib/broadcast/vod-archive", () => ({ syncVodArchive: vi.fn(), syncVodArchiveDeep: vi.fn() }));
import { fetchComments, selectTimelineTargets, pickTimelineSyncTargets, syncVodTimelines, maybeSyncTimelines } from "@/lib/broadcast/vod-timeline";

const now = Date.parse("2026-09-21T12:00:00Z");
const old = "2020-01-01T00:00:00Z";
const recent = "2026-09-18T16:30:19Z";
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("late fan timeline rotation", () => {
  it("reserves recent slots without excluding years-old uploads", () => {
    const vods = Array.from({ length: 600 }, (_, i) => ({ title_no: i + 1, reg_date: i < 590 ? old : recent }));
    const attempts = vods.map((v) => ({ title_no: v.title_no, synced_at: old }));
    expect(selectTimelineTargets(vods, attempts, 8, now)).toEqual([1, 591, 2, 592, 3, 593, 4, 594]);
    // Successful checks and failed attempts both move forward; no permanent exclusion.
    const checked = selectTimelineTargets(vods, attempts, 8, now);
    for (const row of attempts) if (checked.includes(row.title_no)) row.synced_at = new Date(now).toISOString();
    expect(selectTimelineTargets(vods, attempts, 8, now)).toEqual([5, 595, 6, 596, 7, 597, 8, 598]);
  });
  it("deduplicates and fills spare slots when few recent uploads exist", () => {
    expect(selectTimelineTargets([{ title_no: 1, reg_date: recent }, { title_no: 2, reg_date: old }], [], 8, now)).toEqual([1, 2]);
  });
  it("reads archive and timeline pages beyond the REST cap", async () => {
    const ranges: number[] = [];
    admin.mockReturnValue({ from: (table: string) => ({ select: () => ({ order: () => ({ range: async (offset: number) => {
      ranges.push(offset);
      const rows = Array.from({ length: offset === 0 ? 500 : 1 }, (_, i) => table === "vod_archive"
        ? { title_no: offset + i + 1, reg_date: old }
        : { title_no: offset + i + 1, synced_at: offset === 500 ? old : recent });
      return { data: rows, error: null };
    } }) }) }) });
    expect((await pickTimelineSyncTargets())[0]).toBe(501);
    expect(ranges).toEqual([0, 500, 0, 500]);
  });
});

describe("complete upstream reads", () => {
  it("replaces an initially empty timeline when a fan posts later, then follows later edits", async () => {
    let stored: { entries: unknown[]; rootCommentNo?: number }[] = [];
    admin.mockReturnValue({
      from: () => ({ select: () => ({ in: async () => ({ data: [{ title_no: 42, duration_ms: 5000 }] }) }) }),
      rpc: vi.fn().mockImplementation(async (fn, args) => {
        if (fn === "vod_timeline_ingest") stored = args.p_candidates;
        return { error: null, data: true };
      })
    });
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const respond = (comment?: string) => fetcher.mockResolvedValueOnce(Response.json({
      data: comment ? [{ p_comment_no: 123, user_nick: "Fan", comment }] : [], meta: { last_page: 1 }
    }));
    respond();
    await syncVodTimelines([42]);
    expect(stored).toHaveLength(0);
    respond("00:01 A\n00:02 B\n00:03 C");
    await syncVodTimelines([42]);
    expect(stored[0].entries).toHaveLength(3);
    expect(stored[0].rootCommentNo).toBe(123);
    respond("00:01 A\n00:02 B\n00:03 C\n00:04 Later addition");
    await syncVodTimelines([42]);
    expect(stored[0].entries).toHaveLength(4);
  });
  it("finds a timeline beyond the former two-page limit", async () => {
    const fetcher = vi.fn().mockImplementation(async (url: string) => {
      const page = Number(new URL(url).searchParams.get("page"));
      return Response.json({ data: page === 3 ? [{ p_comment_no: 1, comment: "00:01 A\n00:02 B\n00:03 C" }] : [], meta: { last_page: 3 } });
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchComments(42, "guest-host")).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[0][0]).toContain("/guest-host/");
  });
  it.each(["http", "malformed", "timeout", "partial"])("preserves content after %s failure", async (kind) => {
    const fetcher = vi.fn().mockImplementation(async () => {
      if (kind === "timeout") throw new Error("timeout");
      if (kind === "malformed") return Response.json({ data: null });
      if (kind === "partial" && fetcher.mock.calls.length === 1) return Response.json({ data: [{ p_comment_no: 1, comment: "00:01 A" }], meta: { last_page: 2 } });
      return new Response("", { status: 503 });
    });
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchComments(42)).toBeNull();
  });
  it("distinguishes a valid empty comment list from a failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [], meta: { last_page: 1 } })));
    expect(await fetchComments(42)).toEqual([]);
  });
  it("failure writes only attempt time and does not replace existing entries", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const rpc = vi.fn();
    admin.mockReturnValue({ from: () => ({ select: () => ({ in: async () => ({ data: [{ title_no: 42, duration_ms: 5000 }] }) }), upsert, update }), rpc });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await syncVodTimelines([42]);
    expect(upsert).toHaveBeenCalledWith({ title_no: 42, synced_at: expect.any(String) }, { onConflict: "title_no", ignoreDuplicates: true });
    expect(update).toHaveBeenCalledWith({ synced_at: expect.any(String) });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("records unknown-duration attempts without erasing content or requesting comments", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    admin.mockReturnValue({ from: () => ({ select: () => ({ in: async () => ({ data: [{ title_no: 42, duration_ms: 0 }] }) }), upsert, update }) });
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await syncVodTimelines([42]);
    expect(fetcher).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({ synced_at: expect.any(String) });
  });
  it("bounds parallel reply reads and collects every thread", async () => {
    let active = 0, peak = 0;
    const roots = Array.from({ length: 9 }, (_, i) => ({ p_comment_no: i + 1, c_comment_cnt: 1, comment: "00:01 A" }));
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
      if (!url.endsWith("/reply")) return Response.json({ data: roots, meta: { last_page: 1 } });
      active++; peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 1));
      active--;
      const parent = Number(url.split("/").at(-2));
      return Response.json({ data: [{ p_comment_no: parent, c_comment_no: parent, comment: "00:02 B" }], reply_hidden_list: [] });
    }));
    const result = await fetchComments(42);
    expect(result).toHaveLength(9);
    expect(result?.every((c) => c.replies?.length === 1)).toBe(true);
    expect(peak).toBe(4);
  });
  it("throttles timeline checks using their own timestamp", async () => {
    const from = vi.fn().mockReturnValue({ select: () => ({ order: () => ({ limit: async () => ({ data: [{ synced_at: new Date().toISOString() }] }) }) }) });
    admin.mockReturnValue({ from });
    await maybeSyncTimelines();
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("vod_timeline");
  });
  it("fetches complete replies with their parent and preserves snapshot on reply failure", async () => {
    const root = { p_comment_no: 42, c_comment_cnt: 1, user_id: "author", comment: "00:01 Start" };
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ data: [root], meta: { last_page: 1 } }))
      .mockResolvedValueOnce(Response.json({ data: [{ p_comment_no: 42, c_comment_no: 10, user_id: "author", comment: "00:02 More" }], reply_hidden_list: [] }));
    vi.stubGlobal("fetch", fetcher);
    expect((await fetchComments(1))?.[0].replies).toHaveLength(1);
    expect(fetcher.mock.calls[1][0]).toContain("/comment/42/reply");
    fetcher.mockResolvedValueOnce(Response.json({ data: [root], meta: { last_page: 1 } }))
      .mockResolvedValueOnce(new Response("", { status: 503 }));
    expect(await fetchComments(1)).toBeNull();
  });
  it("still attempts a recent upload when archive requests consume the budget", async () => {
    let clock = now;
    vi.spyOn(Date, "now").mockImplementation(() => clock);
    const upsert = vi.fn().mockResolvedValue({ error: null });
    admin.mockReturnValue({ from: () => ({
      select: () => ({ in: async () => ({ data: Array.from({ length: 10 }, (_, i) => ({ title_no: i + 1, duration_ms: 600000 })) }) }), upsert,
      update: () => ({ eq: async () => ({ error: null }) })
    }) });
    const fetcher = vi.fn().mockImplementation(async () => {
      clock += 8000;
      return new Response("", { status: 503 });
    });
    vi.stubGlobal("fetch", fetcher);
    const vods = Array.from({ length: 10 }, (_, i) => ({ title_no: i + 1, reg_date: i === 9 ? recent : old }));
    await syncVodTimelines(selectTimelineTargets(vods, [], 8, now));
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][0]).toContain("/title/10/");
  });
});
