import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  configured: true,
  failure: "",
  missing: false,
  missingCalendarRow: false,
  events: [] as Record<string, unknown>[],
  studioEvents: [] as Record<string, unknown>[],
  publicReads: [] as { table: string; columns: string; range?: [number, number]; order: string[]; filters: [string, unknown][] }[],
  cache: new Map<string, Promise<unknown>>(),
  retained: new Map<string, unknown>(),
  probeSignals: [] as AbortSignal[],
  probeWait: false,
  rpcData: {} as Record<string, unknown>,
}));

vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>, parts: string[]) => (...args: unknown[]) => {
    const key = `${parts.join(":")}:${JSON.stringify(args)}`;
    const prior = state.cache.get(key); if (prior) return prior;
    const pending = Promise.resolve().then(() => fn(...args)).then(value => {
      state.retained.set(key, value); return value;
    }, error => { state.cache.delete(key); throw error; });
    state.cache.set(key, pending); return pending;
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }));
vi.mock("@/lib/auth/config", () => ({ isSupabaseConfigured: () => state.configured }));
vi.mock("@/lib/perf/perf", () => ({ timed: (_label: string, run: () => Promise<unknown>) => run() }));
vi.mock("@/lib/auth/actor", () => ({ resolveCurrentActor: async () => ({ role: "owner", isAuthenticated: true, email: null }) }));
vi.mock("@/lib/private-layer/unlock", () => ({ getUnlockState: async () => ({ hasUnlockSession: true }) }));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: () => null }));
vi.mock("@/lib/private-layer/secret-crypto", () => ({ isCiphertext: () => false, decryptSecret: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => client() }));
vi.mock("@/lib/auth/server", () => ({ createSupabaseServerClient: async () => client() }));

function client() {
  return {
    from(table: string) {
      const query: Record<string, unknown> = {};
      const request = { table, columns: "", range: undefined as [number, number] | undefined, order: [] as string[], filters: [] as [string, unknown][] };
      let signal: AbortSignal | undefined;
      query.select = (columns: string) => { request.columns = columns; return query; };
      for (const method of ["eq", "neq", "is", "gt", "in"]) query[method] = (column: string, value: unknown) => { request.filters.push([`${method}:${column}`, value]); return query; };
      query.order = (column: string) => { request.order.push(column); return query; };
      query.limit = () => query;
      query.range = (from: number, to: number) => { request.range = [from, to]; return query; };
      query.abortSignal = (value: AbortSignal) => { signal = value; state.probeSignals.push(value); return query; };
      const read = async (): Promise<{ data: unknown; error: unknown }> => {
        state.publicReads.push(request);
        if (signal && state.probeWait) return new Promise(resolve => {
          const stop = () => resolve({ data: null, error: { message: "synthetic aborted" } });
          if (signal!.aborted) stop(); else signal!.addEventListener("abort", stop, { once: true });
        });
        const fail = state.failure === "lookup" && table === "calendars" && request.columns === "id"
          || state.failure === "calendar" && table === "calendars" && request.columns !== "id"
          || state.failure === table
          || state.failure === "events-page-2" && ["public_schedule_events", "events"].includes(table) && request.range?.[0] === 1000;
        if (fail) return { data: null, error: { message: "PRIVATE_DATABASE_ERROR_CANARY" } };
        if (table === "calendars") return { data: state.missing || state.missingCalendarRow && request.columns !== "id" ? null : request.columns === "id" ? { id: "fixture-calendar" } : { id: "fixture-calendar", slug: "vic", display_name: "fixture", title: "fixture", poster_theme: "none" }, error: null };
        const rows = table === "public_schedule_events" ? state.events : table === "events" ? state.studioEvents : table === "broadcast_tags" ? [{ id: "public-tag", tag_key: "fixture", display_name: "공개 태그", color_key: "mint", sort_order: 0, is_default: false, is_active: true }] : [];
        return { data: request.range ? rows.slice(request.range[0], request.range[1] + 1) : rows, error: null };
      };
      query.maybeSingle = async () => {
        const result = await read();
        return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data };
      };
      query.then = (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => read().then(resolve, reject);
      return query;
    },
    rpc: async (name: string) => state.failure === name ? { data: null, error: { message: "PRIVATE_DATABASE_ERROR_CANARY" } }
      : { data: Object.hasOwn(state.rpcData, name) ? state.rpcData[name] : [], error: null },
  };
}

function event(index = 0): Record<string, unknown> {
  return {
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    date_key: "2026-06-10", end_date_key: null, link_next: null, is_support: false,
    support_kind: null, support_url: null, start_time: null, end_time: null,
    is_all_day: true, is_tentative: false, public_title: "공개 합성 일정", public_description: null,
    status: "scheduled", sort_order: 0, category: "stream", teaser: false,
    teaser_reveal_at: null, event_tags: [], visibility_scope: "public", secret_cipher: null,
    event_private_meta: null,
  };
}

beforeEach(() => {
  vi.resetModules(); state.configured = true; state.failure = ""; state.missing = state.missingCalendarRow = state.probeWait = false;
  state.events = [event()]; state.studioEvents = [event()]; state.publicReads.length = 0;
  state.cache.clear(); state.retained.clear(); state.probeSignals.length = 0;
  state.rpcData = {};
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("UNEXPECTED_NETWORK"))));
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("public schedule failures never become successful empty cache values", () => {
  for (const failure of ["lookup", "calendar", "public_schedule_events", "broadcast_tags", "color_palette", "get_event_heart_counts", "get_teaser_hope_counts", "vod_archive", "vod_timeline", "vod_upload"]) {
    it(`rejects ${failure} failure and recovers on the next healthy read`, async () => {
      const { getPublicSchedule } = await import("@/lib/schedules/public-loader");
      state.failure = failure;
      await expect(getPublicSchedule("vic", { includeMyHeartIds: false })).rejects.toThrow(/unavailable/i);
      expect(state.retained.has('public-schedule-data:["vic"]')).toBe(false);
      state.failure = "";
      const result = await getPublicSchedule("vic", { includeMyHeartIds: false });
      expect(result.events).toHaveLength(1); expect(result.tags).toHaveLength(1);
      expect(JSON.stringify(result)).not.toContain("PRIVATE_DATABASE_ERROR_CANARY");
    });
  }
  it("keeps verified nonexistence as a normal empty calendar", async () => {
    state.missing = true;
    const { getPublicSchedule } = await import("@/lib/schedules/public-loader");
    const result = await getPublicSchedule("vic", { includeMyHeartIds: false });
    expect(result.events).toEqual([]); expect(result.tags).toEqual([]);
    expect(state.retained.has('public-schedule-data:["vic"]')).toBe(true);
  });
  it("keeps an absent/private calendar row empty after a previously cached id", async () => {
    state.missingCalendarRow = true;
    const { getPublicSchedule } = await import("@/lib/schedules/public-loader");
    expect((await getPublicSchedule("vic", { includeMyHeartIds: false })).events).toEqual([]);
  });
  it("paginates1001 public rows using identical calendar/draft filters and deterministic tie order", async () => {
    state.events = Array.from({ length: 1001 }, (_, index) => event(index));
    const { getPublicSchedule } = await import("@/lib/schedules/public-loader");
    const result = await getPublicSchedule("vic", { includeMyHeartIds: false });
    expect(result.events).toHaveLength(1001);
    expect(new Set(result.events.map(row => row.id)).size).toBe(1001);
    const reads = state.publicReads.filter(read => read.table === "public_schedule_events");
    expect(reads.map(read => read.range)).toEqual([[0, 999], [1000, 1999]]);
    for (const read of reads) {
      expect(read.order).toEqual(["date_key", "created_at", "id"]);
      expect(read.filters).toEqual([["eq:calendar_id", "fixture-calendar"], ["neq:status", "draft"]]);
    }
  });
  it("rejects a failed second page without caching the first1000 rows", async () => {
    state.events = Array.from({ length: 1001 }, (_, index) => event(index)); state.failure = "events-page-2";
    const { getPublicSchedule } = await import("@/lib/schedules/public-loader");
    await expect(getPublicSchedule("vic", { includeMyHeartIds: false })).rejects.toThrow("unavailable");
    expect(state.retained.has('public-schedule-data:["vic"]')).toBe(false);
  });
  it("preserves teaser masking and explicit DTO allowlists across the page boundary", async () => {
    state.events = Array.from({ length: 1001 }, (_, index) => event(index));
    state.events[1000] = { ...event(1000), teaser: true, teaser_reveal_at: "2099-06-10T12:00:00+09:00", public_title: "HIDDEN_TITLE_CANARY", public_description: "HIDDEN_BODY_CANARY", start_time: "22:13:00", event_tags: [{ tag_id: "HIDDEN_TAG_CANARY", is_primary: true, sort_order: 0 }], private_memo: "PRIVATE_META_CANARY", owner_email: "SYNTHETIC_IDENTITY_CANARY" };
    const { getPublicSchedule } = await import("@/lib/schedules/public-loader");
    const result = await getPublicSchedule("vic", { includeMyHeartIds: false });
    const masked = result.events[1000]; expect(masked.teaser).toBe(true); expect(masked.publicTitle).toBe(""); expect(masked.tagIds).toEqual([]);
    for (const secret of ["HIDDEN_TITLE_CANARY", "HIDDEN_BODY_CANARY", "HIDDEN_TAG_CANARY", "22:13", "PRIVATE_META_CANARY", "SYNTHETIC_IDENTITY_CANARY"]) expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.myHeartIds).toEqual([]);
  });
});

describe("studio pagination shares the same safe read mechanism", () => {
  it("reads1001 rows with tombstone/calendar guards and stable ordering on every page", async () => {
    state.studioEvents = Array.from({ length: 1001 }, (_, index) => event(index));
    const { getStudioSchedule } = await import("@/lib/schedules/studio-loader");
    const result = await getStudioSchedule("vic"); expect(result.events).toHaveLength(1001);
    const reads = state.publicReads.filter(read => read.table === "events");
    expect(reads.map(read => read.range)).toEqual([[0, 999], [1000, 1999]]);
    for (const read of reads) {
      expect(read.order).toEqual(["date_key", "created_at", "id"]);
      expect(read.filters).toEqual([["is:deleted_at", null], ["eq:calendar_id", "fixture-calendar"]]);
    }
  });
  it("does not let developer pagination expose owner_private rows", async () => {
    state.studioEvents = Array.from({ length: 1001 }, (_, index) => ({ ...event(index), visibility_scope: index === 1000 ? "owner_private" : "public" }));
    const { getStudioSchedule } = await import("@/lib/schedules/studio-loader");
    const result = await getStudioSchedule("vic", { actor: { role: "developer", isAuthenticated: true, email: null }, unlock: { hasUnlockSession: true, passcodeSet: true, isDefaultPasscode: false } });
    expect(result.events).toHaveLength(1000); expect(result.events.every(row => row.visibilityScope === "public")).toBe(true);
  });
  it("fails the studio read when a later page fails", async () => {
    state.studioEvents = Array.from({ length: 1001 }, (_, index) => event(index)); state.failure = "events-page-2";
    const { getStudioSchedule } = await import("@/lib/schedules/studio-loader");
    await expect(getStudioSchedule("vic")).rejects.toThrow("unavailable");
  });
});

describe("search failure telemetry uses a fixed code only", () => {
  it("never logs the query or DB error canary", async () => {
    state.failure = "search_public";
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { searchPublic } = await import("@/lib/schedules/public-loader");
    const result = await searchPublic("vic", "synthetic-search-canary@example.invalid");
    expect(result.failed).toBe(true); expect(warning).toHaveBeenCalledWith("[search] unavailable", { code: "rpc-error" });
    const logs = JSON.stringify(warning.mock.calls);
    expect(logs).not.toContain("synthetic-search-canary"); expect(logs).not.toContain("PRIVATE_DATABASE_ERROR_CANARY");
  });
});

describe("VOD timeline failure stays distinct from a verified missing row", () => {
  it("rejects a DB error with a fixed message instead of a successful null", async () => {
    state.failure = "vod_timeline";
    const { getPublicVodTimeline } = await import("@/lib/schedules/public-loader");
    await expect(getPublicVodTimeline(123)).rejects.toThrow("Public VOD timeline unavailable");
  });
  it("retains normal null for a successful no-row read", async () => {
    const { getPublicVodTimeline } = await import("@/lib/schedules/public-loader");
    expect(await getPublicVodTimeline(123)).toBeNull();
  });
});

const aggregateCases = [
  { kind: "stats", rpc: "get_public_broadcast_stats", rows: [{ ym: "2026-06", hours: 3, days: 1, sessions: 1, privateMemo: "PRIVATE_AGGREGATE_CANARY" }], expected: [{ ym: "2026-06", hours: 3, days: 1, sessions: 1 }] },
  { kind: "daily", rpc: "get_public_broadcast_daily", rows: [{ day: "2026-06-10", hours: 2, ownerEmail: "PRIVATE_AGGREGATE_CANARY" }], expected: Array.from({ length: 30 }, (_, i) => i === 9 ? 2 : 0) },
  { kind: "suggest", rpc: "search_suggest", rows: [{ term: "공개 추천", kind: "term", weight: 1, privateMemo: "PRIVATE_AGGREGATE_CANARY" }], expected: [{ term: "공개 추천", kind: "term", weight: 1 }] },
  { kind: "related", rpc: "search_related", rows: [{ name: "public", display: "공개 인물", co_docs: 1, hapbang: 0, visits: 1, ownerEmail: "PRIVATE_AGGREGATE_CANARY" }], expected: [{ name: "public", display: "공개 인물", coDocs: 1, hapbang: 0, visits: 1 }] },
  { kind: "terms", rpc: "search_related_terms", rows: [{ term: "공개 관련어", co_docs: 1, kind: "rel", privateMemo: "PRIVATE_AGGREGATE_CANARY" }], expected: [{ term: "공개 관련어", coDocs: 1, kind: "rel" }] },
  { kind: "trending", rpc: "search_trending", rows: [{ term: "공개 화제", recent: 1, ratio: 2, ownerEmail: "PRIVATE_AGGREGATE_CANARY" }], expected: [{ term: "공개 화제", recent: 1, ratio: 2 }] }
] as const;
async function readAggregate(kind: string) {
  const api = await import("@/lib/schedules/public-loader");
  if (kind === "stats") return api.getPublicBroadcastStats(6, { year: 2026, month: 6 });
  if (kind === "daily") return api.getPublicBroadcastDaily(2026, 6);
  if (kind === "suggest") return api.getPublicSearchSuggest("합성 검색어");
  if (kind === "related") return api.getPublicSearchRelated("합성 검색어");
  if (kind === "terms") return api.getPublicSearchRelatedTerms("합성 검색어");
  return api.getPublicSearchTrending();
}
describe.each(aggregateCases)("public aggregate $kind failure distinction", item => {
  it("rejects RPC errors with fixed text and recovers with an allowlisted result", async () => {
    state.failure = item.rpc;
    await expect(readAggregate(item.kind)).rejects.toThrow(/unavailable/);
    state.failure = ""; state.rpcData[item.rpc] = item.rows;
    const result = await readAggregate(item.kind);
    expect(result).toEqual(item.expected);
    expect(JSON.stringify(result)).not.toContain("PRIVATE_AGGREGATE_CANARY");
    expect(JSON.stringify(result)).not.toContain("PRIVATE_DATABASE_ERROR_CANARY");
  });
  it("treats a successful empty array as genuine absence", async () => {
    expect(await readAggregate(item.kind)).toEqual(item.kind === "daily" ? Array(30).fill(0) : []);
  });
  it("rejects a null/non-array RPC payload without pretending it is empty", async () => {
    state.rpcData[item.rpc] = null;
    await expect(readAggregate(item.kind)).rejects.toThrow(/unavailable/);
  });
});

describe("public VOD chat distinguishes genuine absence and unavailable analysis", () => {
  it("rejects a source error and recovers through the existing public projection", async () => {
    const { getPublicVodChatProfile } = await import("@/lib/schedules/public-loader");
    state.failure = "vod_chat_profile";
    await expect(getPublicVodChatProfile(42)).rejects.toThrow("Public VOD chat profile unavailable");
    state.failure = "";
    state.rpcData.vod_chat_profile = { binSec: 30, laughTier: "high", ownerEmail: "PRIVATE_CHAT_CANARY", bins: [
      { i: 0, h: 0.8, d: 0.4, l: 0.1, t: ["공개", "단어", "셋", "넷"], speakerCount: 2, privateMemo: "PRIVATE_CHAT_CANARY" }
    ] };
    const result = await getPublicVodChatProfile(42);
    expect(result).toEqual({ binSec: 30, laughTier: "high", bins: [{ i: 0, h: 0.8, d: 0.4, l: 0.1, t: ["공개", "단어", "셋"] }] });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_CHAT_CANARY");
    expect(JSON.stringify(result)).not.toContain("speakerCount");
  });
  it.each([null, { binSec: 30, laughTier: null, bins: [] }])("retains normal null for genuine absence: %j", async value => {
    state.rpcData.vod_chat_profile = value;
    const { getPublicVodChatProfile } = await import("@/lib/schedules/public-loader");
    expect(await getPublicVodChatProfile(42)).toBeNull();
  });
  it.each([[], "invalid", {}, { binSec: 30, laughTier: null, bins: "invalid" },
    { binSec: 30, laughTier: null, bins: [null] },
    { binSec: 30, laughTier: null, bins: [{ i: "invalid" }] },
    { binSec: 30, laughTier: null, bins: [{ i: -1 }] },
    { binSec: 30, laughTier: null, bins: [{ i: 0, h: "invalid", d: 0, l: 0, t: [] }] },
    { binSec: 30, laughTier: null, bins: [{ i: 0, h: 0, d: 0, l: 0, t: null }] }
  ])("rejects malformed data instead of pretending there are no bins: %j", async value => {
    state.rpcData.vod_chat_profile = value;
    const { getPublicVodChatProfile } = await import("@/lib/schedules/public-loader");
    await expect(getPublicVodChatProfile(42)).rejects.toThrow("Public VOD chat profile unavailable");
  });
  it("preserves short-query and unconfigured empty fallbacks for related searches", async () => {
    const { getPublicSearchRelated, getPublicSearchRelatedTerms } = await import("@/lib/schedules/public-loader");
    state.failure = "search_related";
    expect(await getPublicSearchRelated("a")).toEqual([]);
    state.failure = "search_related_terms";
    expect(await getPublicSearchRelatedTerms("a")).toEqual([]);
    state.configured = false;
    expect(await getPublicSearchRelated("합성 검색어")).toEqual([]);
    expect(await getPublicSearchRelatedTerms("합성 검색어")).toEqual([]);
  });
});

describe("public readiness is a bounded id-only anonymous query", () => {
  it("passes the caller signal to the real query builder without loading events", async () => {
    const { probePublicScheduleRead } = await import("@/lib/schedules/public-loader"); const abort = new AbortController();
    expect(await probePublicScheduleRead(abort.signal)).toEqual({ ok: true });
    expect(state.probeSignals).toEqual([abort.signal]);
    expect(state.publicReads).toEqual([{ table: "calendars", columns: "id", range: undefined, order: [], filters: [["eq:slug", "vic"], ["eq:is_public", true]] }]);
  });
  it("abort terminates an in-progress query instead of racing abandoned work", async () => {
    state.probeWait = true;
    const { probePublicScheduleRead } = await import("@/lib/schedules/public-loader"); const abort = new AbortController();
    const result = probePublicScheduleRead(abort.signal); abort.abort();
    expect(await result).toEqual({ ok: false, reason: "timeout" });
  });
  it("configuration absence is not healthy sample data", async () => {
    state.configured = false;
    const { probePublicScheduleRead } = await import("@/lib/schedules/public-loader");
    expect(await probePublicScheduleRead(new AbortController().signal)).toEqual({ ok: false, reason: "unconfigured" });
    expect(state.publicReads).toEqual([]);
  });
});
