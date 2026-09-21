import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
import { pickChatSyncTargets, syncVodChat } from "@/lib/broadcast/vod-chat";

const chat = (key: string) => `https://videoimg.sooplive.co.kr/php/ChatLoadSplit.php?rowKey=${key}`;
const xml = (t: number) => `<root><chat><m><![CDATA[재미있다 ㅋㅋ]]></m><u>private-speaker-canary</u><n>private-nick-canary</n><t>${t}</t></chat></root>`;
type Commit = { p_title_no: number; p_revision: number; p_job: { state: unknown; complete: boolean; chunks: number; messages: number; nextRetryAt: string }; p_snapshot: unknown };
let job: { revision: number; state: unknown; complete: boolean } | null;
let commits: Commit[];
let published: unknown;
let files: { chat?: string; duration: number; file_order?: number }[];
let broken: Set<string>;
let failView: boolean;
let conflict: boolean;
let databaseError: boolean;
let role: number;
let broadcastDay: string;
let fetcher: ReturnType<typeof vi.fn>;
let rpc: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-21T15:00:00Z"));
  job = null; commits = []; published = "old-profile";
  files = [{ chat: chat("main"), duration: 600_000 }];
  broken = new Set(); failView = false; conflict = false; databaseError = false; role = 101;
  broadcastDay = "2020-01-01";
  rpc = vi.fn((name: string, args: Commit) => {
    const run = async () => {
    if (name === "search_known_people") return { data: [], error: null };
    if (name === "vod_chat_pick_jobs") return { data: [{ title_no: 42 }], error: null };
    commits.push(structuredClone(args));
    if (databaseError) return { data: null, error: { message: "database unavailable" } };
    if (conflict) return { data: false, error: null };
    job = { revision: (job?.revision ?? 0) + 1, state: structuredClone(args.p_job.state), complete: args.p_job.complete };
    if (args.p_snapshot) published = structuredClone(args.p_snapshot);
    return { data: true, error: null };
    };
    const result = run();
    return Object.assign(result, { abortSignal: () => result });
  });
  mocks.admin.mockReturnValue({ rpc, from: (table: string) => {
    const chain = { select: () => chain, eq: () => chain, order: () => chain, abortSignal: () => chain,
      maybeSingle: async () => ({ data: table === "vod_archive" ? { title: "테스트", auth_no: role, broadcast_day: broadcastDay } : structuredClone(job), error: null }),
      limit: async () => ({ data: [], error: null }) };
    return chain;
  } });
  fetcher = vi.fn(async (input: string) => {
    if (input.includes("/video/a/view")) return Response.json({ result: 1, data: { files } }, { status: failView ? 503 : 200 });
    const url = new URL(input);
    if (broken.has(url.searchParams.get("rowKey")!) || broken.has(input)) return new Response(null, { status: 404 });
    return new Response(xml(Number(url.searchParams.get("startTime")) + 10));
  });
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
async function run(budget = 60, ms = 35_000) {
  const pending = syncVodChat([42], budget, ms);
  await vi.runAllTimersAsync();
  return pending;
}

describe("resumable chat analysis", () => {
  it("skips a missing first file, preserves its offset and retries it without double counting later files", async () => {
    files = [{ chat: chat("missing"), duration: 32_000 }, { chat: chat("main"), duration: 600_000 }];
    broken.add("missing");
    expect((await run()).chunks).toBe(2);
    expect(commits[0].p_job.complete).toBe(false);
    expect(commits[0].p_job.state).toMatchObject({ cursor: 3, missing: [0], messages: 2 });
    expect(published).toMatchObject({ bins: [{ bin: 1, msgs: 1 }, { bin: 11, msgs: 1 }] });
    expect(JSON.stringify(commits)).not.toMatch(/private-speaker|private-nick|rowKey|재미있다 ㅋㅋ/);
    fetcher.mockClear(); broken.clear();
    expect((await run()).chunks).toBe(1);
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes("ChatLoadSplit"))).toHaveLength(1);
    expect(commits[1].p_job).toMatchObject({ complete: true, messages: 3, state: null });
    expect(published).toMatchObject({ terms: [{ term: "재미있다", cnt: 3 }] });
  });
  it("checkpoints at the budget, uses 300-second windows, and preserves old publication until traversal finishes", async () => {
    await run(1);
    expect(published).toBe("old-profile");
    expect(commits[0].p_job.state).toMatchObject({ cursor: 1, chunks: 1 });
    await run(1);
    const calls = fetcher.mock.calls.map(([url]) => String(url)).filter(url => url.includes("ChatLoadSplit"));
    expect(calls.map(url => new URL(url).searchParams.get("startTime"))).toEqual(["0", "300"]);
    expect(commits[1].p_job.complete).toBe(true);
    expect(published).toMatchObject({ terms: [{ cnt: 2 }] });
  });
  it("publishes earlier valid chunks even when the last remaining chunk fails", async () => {
    await run(1);
    broken.add(`${chat("main")}&startTime=300`);
    await run(1);
    expect(published).toMatchObject({ terms: [{ cnt: 1 }] });
    expect(commits[1].p_job.complete).toBe(false);
  });
  it("does not mark unavailable metadata complete or erase prior progress", async () => {
    await run(1);
    const state = structuredClone(job?.state);
    failView = true;
    await run();
    expect(job?.state).toEqual(state);
    expect(commits[1].p_job.complete).toBe(false);
    expect(published).toBe("old-profile");
    expect(Date.parse(commits[1].p_job.nextRetryAt)).toBeGreaterThan(Date.now());
  });
  it("starts a new pass for changed source metadata without merging the old staged totals", async () => {
    await run(1);
    files = [{ chat: chat("replaced"), duration: 300_000 }];
    await run();
    expect(published).toMatchObject({ terms: [{ cnt: 1 }] });
  });
  it.each(["conflict", "error"])("does not report persisted work on checkpoint %s", async (kind) => {
    conflict = kind === "conflict"; databaseError = kind === "error";
    const result = await run();
    expect(result.chunks).toBe(0); expect(published).toBe("old-profile");
    if (databaseError) expect(result.ok).toBe(false);
  });
  it("does no source work after its time budget and never reads private VOD chat", async () => {
    await run(60, 0); expect(fetcher).not.toHaveBeenCalled();
    role = 102;
    await run(); expect(fetcher).not.toHaveBeenCalled(); expect(commits).toHaveLength(0);
  });
  it("does not fetch arbitrary hosts supplied by source metadata", async () => {
    files = [{ chat: "https://private.invalid/php/ChatLoadSplit.php", duration: 300_000 }];
    await run();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(commits[0].p_job).toMatchObject({ complete: false, chunks: 0 });
  });
  it("uses the uncapped database due queue instead of legacy complete flags", async () => {
    expect(await pickChatSyncTargets(4)).toEqual([42]);
    expect(rpc).toHaveBeenCalledWith("vod_chat_pick_jobs", { p_limit: 4 });
  });
  it.each([["2026-09-09", 1], ["2026-09-08", 30]])("rechecks completed %s sources after %s days using KST", async (day, days) => {
    broadcastDay = String(day);
    await run();
    expect(Date.parse(commits[0].p_job.nextRetryAt) - Date.now()).toBe(Number(days) * 86400_000);
  });
});
