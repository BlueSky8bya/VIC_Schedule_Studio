import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), live: vi.fn(), after: vi.fn(), tick: vi.fn(), revalidate: vi.fn(), xlit: vi.fn() }));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/lib/broadcast/soop", () => ({ BJ_ID: "fixture", fetchSoopLive: mocks.live }));
vi.mock("@/lib/broadcast/session", () => ({ recordLiveTick: mocks.tick }));
vi.mock("@/lib/schedules/cache", () => ({ revalidatePublicSchedule: mocks.revalidate }));
vi.mock("@/lib/search/xlit-sync", () => ({ syncXlitSynonymsChecked: mocks.xlit }));
vi.mock("next/server", () => ({ NextResponse: { json: (body: unknown, init?: ResponseInit) => Response.json(body, init) }, after: mocks.after }));
import { createWorkBudget, singleFlight } from "@/lib/broadcast/work-budget";
import { syncVodArchiveDeep, fetchVodListPage } from "@/lib/broadcast/vod-archive";
import { maybeSyncTimelines, syncVodTimelines } from "@/lib/broadcast/vod-timeline";

type Result = { data: unknown; error: unknown };
type WorkRow = { revision: number; state: Record<string, unknown> | null };
let sweep: WorkRow | null;
let dirty: WorkRow | null;
let rejectCas: boolean;
let failedRpc: string | null;
let clock: number;
const commits: Record<string, unknown>[] = [];
const rpcNames: string[] = [];
const signals: AbortSignal[] = [];
function query(resolve: () => Result) {
  const promise = () => Promise.resolve(resolve());
  const chain = { eq: (key: string, value: unknown) => { void key; void value; return chain; }, in: () => chain, order: () => chain, limit: () => chain,
    select: () => chain, abortSignal: (signal: AbortSignal) => { signals.push(signal); return chain; },
    maybeSingle: promise, then: (...args: Parameters<Promise<Result>["then"]>) => promise().then(...args) };
  return chain;
}
function db() {
  return { from: (table: string) => {
    let key: unknown, revision: unknown;
    const q = query(() => ({ data: table === "vod_archive" ? [{ title_no: 42, duration_ms: 5000 }] :
      table === "vod_timeline" ? [{ synced_at: new Date().toISOString() }] : key === "timeline-search" ? dirty : sweep, error: null }));
    q.eq = (field: string, value: unknown) => { if (field === "key") key = value; if (field === "revision") revision = value; return q; };
    return { ...q, update: (patch: { state: Record<string, unknown> }) => {
      const update = query(() => { if (dirty && dirty.revision === revision) dirty.state = patch.state; return { data: null, error: null }; });
      update.eq = q.eq = (field: string, value: unknown) => { if (field === "revision") revision = value; return update; };
      return update;
    } };
  }, rpc: (name: string, args?: Record<string, unknown>) => query(() => {
    rpcNames.push(name);
    if (name === failedRpc) return { data: null, error: { message: "synthetic unavailable" } };
    if (name === "vod_archive_sweep_commit") {
      commits.push(structuredClone(args!));
      if (rejectCas) return { data: { accepted: false, deleted: 0 }, error: null };
      sweep = { revision: (sweep?.revision ?? 0) + 1, state: args!.p_complete ? null : structuredClone(args!.p_state as Record<string, unknown>) };
      return { data: { accepted: true, deleted: args!.p_complete ? 1 : 0 }, error: null };
    }
    if (name === "vod_timeline_ingest_changes") return { data: { accepted: true, changed: false }, error: null };
    return { data: null, error: null };
  }) };
}
const apiRow = (id: number) => ({ title_no: id, title_name: "Synthetic public title", reg_date: "2020-01-01 12:00:00",
  auth_no: 101, ucc: { total_file_duration: 1000, thumb: "" } });
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); clock = 0;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  sweep = null; dirty = null; rejectCas = false; failedRpc = null;
  commits.length = 0; rpcNames.length = 0; signals.length = 0;
  mocks.admin.mockImplementation(db); mocks.tick.mockResolvedValue(undefined); mocks.xlit.mockResolvedValue({ ok: true, count: 0 });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function settle<T>(promise: Promise<T>) { await vi.runAllTimersAsync(); return promise; }

describe("whole-operation monotonic budget", () => {
  it("does not extend the deadline per nested call or after wall clock jumps", () => {
    const budget = createWorkBudget(1000, () => clock);
    clock = 650;
    expect(budget.remaining(100)).toBe(250);
    vi.setSystemTime(new Date("2099-01-01"));
    expect(budget.remaining()).toBe(350);
    clock = 1001;
    expect(budget.signal().aborted).toBe(true);
  });
  it("coalesces concurrent work and releases rejected ownership for retry", async () => {
    let reject!: (error: Error) => void;
    const load = vi.fn().mockImplementationOnce(() => new Promise((_, r) => { reject = r; })).mockResolvedValueOnce(42);
    const joined = singleFlight(load);
    const first = joined(), second = joined();
    expect(first).toBe(second);
    await Promise.resolve();
    const failure = expect(first).rejects.toThrow("fixture failure");
    reject(new Error("fixture failure")); await failure;
    expect(await joined()).toBe(42);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("bounded archive scan", () => {
  it("stores eight pages, resumes page nine, and only then requests atomic complete publication", async () => {
    const pages: number[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const page = Number(new URL(input).searchParams.get("page")); pages.push(page);
      return Response.json({ data: [apiRow(page)], meta: { last_page: 10 } });
    }));
    expect(await settle(syncVodArchiveDeep())).toEqual({ ok: false, total: 8, deleted: 0 });
    expect(commits[0]).toMatchObject({ p_revision: 0, p_complete: false, p_state: { nextPage: 9 } });
    expect(mocks.revalidate).not.toHaveBeenCalled();
    expect(await settle(syncVodArchiveDeep())).toEqual({ ok: true, total: 10, deleted: 1 });
    expect(pages).toEqual([1,2,3,4,5,6,7,8,9,10]);
    expect(commits[1]).toMatchObject({ p_revision: 1, p_complete: true });
    expect(sweep?.state).toBeNull(); expect(mocks.revalidate).toHaveBeenCalledTimes(1);
  });
  it("checkpoints a source failure without falsely finalizing/deleting", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => Number(new URL(input).searchParams.get("page")) === 1
      ? Response.json({ data: [apiRow(1)], meta: { last_page: 2 } }) : new Response(null, { status: 503 })));
    expect(await settle(syncVodArchiveDeep())).toEqual({ ok: false, total: 1, deleted: 0 });
    expect(commits[0].p_complete).toBe(false); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("rejects partial/malformed pagination and dropped rows as deletion proof", async () => {
    for (const response of [{ data: [apiRow(1)] }, { data: [{ title_no: 1 }], meta: { last_page: 1 } },
      { data: [apiRow(1)], meta: { last_page: 501 } }]) {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json(response)));
      expect(await fetchVodListPage(1)).toBeNull();
    }
  });
  it("does not acknowledge/revalidate a stale CAS and coalesces overlapping sweeps", async () => {
    rejectCas = true;
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [apiRow(1)], meta: { last_page: 1 } })));
    const one = syncVodArchiveDeep(), two = syncVodArchiveDeep(); expect(one).toBe(two);
    expect((await settle(one)).ok).toBe(false);
    expect(commits).toHaveLength(1); expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("stops a slow scan at the shared deadline with a reserved checkpoint, never a complete flag", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { clock += 8000; return Response.json({ data: [apiRow(1)], meta: { last_page: 10 } }); }));
    const result = await settle(syncVodArchiveDeep(createWorkBudget(20_000, () => clock)));
    expect(result.ok).toBe(false); expect(commits[0].p_complete).toBe(false);
    expect((commits[0].p_state as { nextPage: number }).nextPage).toBe(3);
    expect(signals.every(s => !s.aborted)).toBe(true);
  });
});

describe("derived search only after content changes", () => {
  it("unchanged accepted ingestion does not run the five global rebuilds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ data: [], meta: { last_page: 1 } })));
    expect((await settle(syncVodTimelines([42]))).saved).toBe(1);
    expect(rpcNames).toEqual(["vod_timeline_ingest_changes"]);
  });
  it("retries a dirty revision without refetching fresh timelines; failures keep it dirty", async () => {
    dirty = { revision: 4, state: { dirty: true } }; failedRpc = "search_game_refresh";
    const warning=vi.spyOn(console,"warn").mockImplementation(()=>{});
    await maybeSyncTimelines();
    expect(rpcNames).toEqual(["search_song_refresh","search_game_refresh"]);
    expect(dirty.state).toEqual({ dirty: true });
    failedRpc = null; rpcNames.length = 0;
    await maybeSyncTimelines();
    expect(rpcNames).toEqual(["search_song_refresh","search_game_refresh","search_graph_rebuild","search_synonyms_rebuild","search_trending_rebuild"]);
    expect(dirty.state).toEqual({ dirty: false }); warning.mockRestore();
  });
  it("retains dirty ownership when xlit fails, but acknowledges a genuinely empty successful result", async () => {
    dirty = { revision: 7, state: { dirty: true } };
    mocks.xlit.mockResolvedValueOnce({ ok: false, count: 0 });
    await maybeSyncTimelines();
    expect(dirty.state).toEqual({ dirty: true });
    await maybeSyncTimelines();
    expect(dirty.state).toEqual({ dirty: false });
  });

});

describe("live cache completion and single-flight", () => {
  it("joins simultaneous misses, owns one background job and starts TTL after source completion", async () => {
    vi.resetModules();
    let resolve!: (value: { isLive: boolean }) => void;
    mocks.live.mockImplementationOnce(() => new Promise(r => { resolve = r; })).mockResolvedValue({ isLive: true });
    const { GET } = await import("@/app/api/soop-live/route");
    vi.setSystemTime(0);
    const first = GET(), second = GET(); await Promise.resolve();
    vi.setSystemTime(30_000); resolve({ isLive: true });
    await Promise.all([first,second]); expect(mocks.live).toHaveBeenCalledTimes(1); expect(mocks.after).toHaveBeenCalledTimes(1);
    vi.setSystemTime(49_999); await GET(); expect(mocks.live).toHaveBeenCalledTimes(1);
    vi.setSystemTime(50_001); await GET(); expect(mocks.live).toHaveBeenCalledTimes(2);
  });
});
