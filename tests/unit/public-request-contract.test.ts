import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const load = vi.hoisted(() => ({
  getPublicSchedule: vi.fn(), getPublicBroadcastStats: vi.fn(), getPublicBroadcastDaily: vi.fn(),
  getPublicVodChatProfile: vi.fn(), getPublicVodTimeline: vi.fn(), searchPublic: vi.fn(),
  getPublicSearchRelated: vi.fn(), getPublicSearchRelatedTerms: vi.fn(),
  getPublicSearchSuggest: vi.fn(), getPublicSearchTrending: vi.fn()
}));
vi.mock("@/lib/schedules/public-loader", () => load);
vi.mock("@/lib/perf/perf", () => ({ ServerTiming: class {
  measure(_key: string, read: () => Promise<unknown>) { return read(); }
  header() { return "publicSchedule;dur=1"; }
} }));

const cases = [
  { name: "events", query: "", duplicate: "x=1&x=2", ttl: "public, s-maxage=300" },
  { name: "broadcast", query: "year=2026&month=10", duplicate: "year=2026&year=2025&month=10", ttl: "public, s-maxage=60" },
  { name: "vod-chat", query: "titleNo=42", duplicate: "titleNo=42&titleNo=43", ttl: "public, max-age=0, s-maxage=30" },
  { name: "vod-timeline", query: "titleNo=42", duplicate: "titleNo=42&titleNo=43", ttl: "public, max-age=0, s-maxage=60" },
  { name: "search", query: "q=synthetic&limit=200", duplicate: "q=one&q=two", ttl: "public, s-maxage=300, stale-while-revalidate=600" },
  { name: "search/suggest", query: "q=synthetic", duplicate: "q=one&q=two", ttl: "public, s-maxage=600, stale-while-revalidate=1200" },
  { name: "search/trending", query: "", duplicate: "x=1&x=2", ttl: "public, s-maxage=300, stale-while-revalidate=600" }
] as const;
type Route = (request: Request, context: { params: Promise<{ calendarSlug: string }> }) => Promise<Response>;
let routes: Record<string, Route>;
const calls = () => Object.values(load).reduce((count, fn) => count + fn.mock.calls.length, 0);
function get(name: string, query = "", slug = "vic") {
  return routes[name](new Request(`https://fixture.test/api/public/${slug}/${name}${query ? `?${query}` : ""}`), {
    params: Promise.resolve({ calendarSlug: slug })
  });
}

beforeEach(async () => {
  vi.resetModules(); for (const fn of Object.values(load)) fn.mockReset();
  load.getPublicSchedule.mockResolvedValue({ calendar: { slug: "vic" }, events: [], tags: [], palette: [], myHeartIds: [] });
  load.getPublicBroadcastStats.mockResolvedValue([{ ym: "2026-10", hours: 1, days: 1, sessions: 1 }]);
  load.getPublicBroadcastDaily.mockResolvedValue([1]);
  load.getPublicVodChatProfile.mockResolvedValue({ binSec: 30, laughTier: null, bins: [{ i: 0, h: 0.5, d: 0.5, l: 0, t: [] }] });
  load.getPublicVodTimeline.mockResolvedValue({ authorNick: "Public source", entries: [] });
  load.searchPublic.mockImplementation(async (_slug: string, q: string) => ({ query: q.trim(), hits: [] }));
  load.getPublicSearchRelated.mockResolvedValue([]); load.getPublicSearchRelatedTerms.mockResolvedValue([]);
  load.getPublicSearchSuggest.mockResolvedValue([]); load.getPublicSearchTrending.mockResolvedValue([]);
  const modules = await Promise.all([
    import("@/app/api/public/[calendarSlug]/events/route"),
    import("@/app/api/public/[calendarSlug]/broadcast/route"),
    import("@/app/api/public/[calendarSlug]/vod-chat/route"),
    import("@/app/api/public/[calendarSlug]/vod-timeline/route"),
    import("@/app/api/public/[calendarSlug]/search/route"),
    import("@/app/api/public/[calendarSlug]/search/suggest/route"),
    import("@/app/api/public/[calendarSlug]/search/trending/route")
  ]);
  routes = Object.fromEntries(cases.map((item, i) => [item.name, modules[i].GET]));
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("UNEXPECTED_NETWORK"))));
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe.each(cases)("public $name contract", item => {
  it("preserves valid response cache policy without identity cookies", async () => {
    const response = await get(item.name, item.query);
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe(item.ttl);
    expect(response.headers.has("set-cookie")).toBe(false); expect(calls()).toBeGreaterThan(0);
  });
  it("rejects an unsupported calendar before any loader call", async () => {
    const response = await get(item.name, item.query, "unknown-synthetic");
    expect(response.status).toBe(404); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(calls()).toBe(0);
  });
  it("rejects an irrelevant cache key before any loader call", async () => {
    const response = await get(item.name, `${item.query}${item.query ? "&" : ""}unexpected=synthetic`);
    expect(response.status).toBe(400); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(calls()).toBe(0); expect(await response.text()).not.toContain("synthetic");
  });
  it("rejects duplicate or unsupported keys before any loader call", async () => {
    const response = await get(item.name, item.duplicate);
    expect(response.status).toBe(400); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(calls()).toBe(0);
  });
});

it.each(["", "year=2000&month=1", "year=10000&month=1", "year=2026.5&month=1", "year=2026&month=0", "year=2026&month=13", "year=2026&month=1.5"])("rejects malformed broadcast bounds: %s", async query => {
  expect((await get("broadcast", query)).status).toBe(400); expect(calls()).toBe(0);
});
it.each([2001, 9999])("retains the broad four-digit broadcast year contract: %s", async year => {
  expect((await get("broadcast", `year=${year}&month=12`)).status).toBe(200);
  expect(load.getPublicBroadcastStats).toHaveBeenCalledWith(6, { year, month: 12 });
  expect(load.getPublicBroadcastDaily).toHaveBeenCalledWith(year, 12);
});
it.each(["vod-chat", "vod-timeline"])("accepts only positive safe-integer titleNo in %s", async name => {
  for (const title of ["", "0", "-1", "42.5", "Infinity", "9007199254740992"]) {
    const response = await get(name, `titleNo=${title}`);
    expect(response.status).toBe(400); expect(response.headers.get("cache-control")).toContain("no-store");
  }
  expect(calls()).toBe(0);
});
it("rejects duplicate limit/month and empty extraneous queries", async () => {
  for (const [name, query] of [["search", "q=x&limit=1&limit=2"], ["broadcast", "year=2026&month=1&month=2"], ["events", "&&"], ["search/trending", "&&"]]) {
    expect((await get(name, query)).status).toBe(400);
  }
  expect(calls()).toBe(0);
});
it("public event failure is an explicit uncached503 with no sensitive error", async () => {
  load.getPublicSchedule.mockRejectedValue(new Error("synthetic-sensitive-canary@example.invalid"));
  const response = await get("events"); expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.text()).not.toContain("synthetic-sensitive-canary");
  expect(load.getPublicSchedule).toHaveBeenCalledWith("vic", { includeMyHeartIds: false });
});
it.each([
  { name: "broadcast", query: "year=2026&month=10", method: "getPublicBroadcastStats" },
  { name: "broadcast", query: "year=2026&month=10", method: "getPublicBroadcastDaily" },
  { name: "search/suggest", query: "q=synthetic", method: "getPublicSearchSuggest" },
  { name: "search/trending", query: "", method: "getPublicSearchTrending" }
] as const)("$method failure yields503 and a subsequent genuine empty read recovers", async item => {
  load[item.method].mockRejectedValue(new Error("synthetic-sensitive-canary@example.invalid"));
  const failed = await get(item.name, item.query);
  expect(failed.status).toBe(503); expect(failed.headers.get("cache-control")).toContain("no-store");
  expect(failed.headers.has("set-cookie")).toBe(false);
  expect(await failed.text()).not.toContain("synthetic-sensitive-canary");
  load.getPublicBroadcastStats.mockResolvedValue([]); load.getPublicBroadcastDaily.mockResolvedValue(Array(31).fill(0));
  load.getPublicSearchSuggest.mockResolvedValue([]); load.getPublicSearchTrending.mockResolvedValue([]);
  const recovered = await get(item.name, item.query);
  expect(recovered.status).toBe(200);
  expect(recovered.headers.get("cache-control")).toBe(cases.find(route => route.name === item.name)!.ttl);
  expect(await recovered.json()).toEqual(item.name === "broadcast" ? { months: [], daily: Array(31).fill(0) }
    : item.name === "search/suggest" ? { items: [] } : { trends: [] });
});
it("keeps search truncation/limit normalization and the existing public fields", async () => {
  load.searchPublic.mockResolvedValue({ query: "source", hits: [], corrected: "교정", failed: false, private_canary: "synthetic-private-canary" });
  const response = await get("search", `q=${"x".repeat(101)}&limit=999.9`);
  expect(load.searchPublic).toHaveBeenCalledWith("vic", "x".repeat(100), 400);
  expect(await response.json()).toEqual({ query: "source", hits: [], corrected: "교정", failed: false, related: { people: [], terms: [] } });
  await get("search/suggest", `q=${"y".repeat(61)}`);
  expect(load.getPublicSearchSuggest).toHaveBeenCalledWith("y".repeat(60), 8);
});
it("VOD chat error is503/no-store and genuine null recovers as the existing empty200", async () => {
  load.getPublicVodChatProfile.mockRejectedValue(new Error("synthetic-sensitive-canary@example.invalid"));
  const failed = await get("vod-chat", "titleNo=42");
  expect(failed.status).toBe(503); expect(failed.headers.get("cache-control")).toContain("no-store");
  expect(await failed.text()).not.toContain("synthetic-sensitive-canary");
  load.getPublicVodChatProfile.mockResolvedValue(null);
  const recovered = await get("vod-chat", "titleNo=42");
  expect(recovered.status).toBe(200); expect(recovered.headers.get("cache-control")).toBe("no-store");
  expect(await recovered.json()).toEqual({ binSec: 30, laughTier: null, bins: [] });
});
it.each(["getPublicSearchRelated", "getPublicSearchRelatedTerms"] as const)("%s failure never caches a partial search bundle and recovers", async method => {
  load[method].mockRejectedValue(new Error("synthetic-sensitive-canary@example.invalid"));
  const failed = await get("search", "q=synthetic");
  expect(failed.status).toBe(503); expect(failed.headers.get("cache-control")).toContain("no-store");
  expect(await failed.text()).not.toContain("synthetic-sensitive-canary");
  load[method].mockResolvedValue([]);
  const recovered = await get("search", "q=synthetic");
  expect(recovered.status).toBe(200);
  expect(recovered.headers.get("cache-control")).toBe("public, s-maxage=300, stale-while-revalidate=600");
  expect(await recovered.json()).toEqual({ query: "synthetic", hits: [], related: { people: [], terms: [] } });
});

describe("search owns only bounded in-flight promises", () => {
  it("coalesces100 identical requests and releases the key after successful completion", async () => {
    let release!: (value: unknown) => void;
    load.searchPublic.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const requests = Array.from({ length: 100 }, () => get("search", "q=synthetic&limit=200"));
    await vi.waitFor(() => expect(load.searchPublic).toHaveBeenCalledOnce());
    expect(load.getPublicSearchRelated).toHaveBeenCalledOnce(); expect(load.getPublicSearchRelatedTerms).toHaveBeenCalledOnce();
    release({ query: "synthetic", hits: [] });
    expect((await Promise.all(requests)).every(response => response.status === 200)).toBe(true);
    load.searchPublic.mockResolvedValue({ query: "synthetic", hits: [] });
    expect((await get("search", "q=synthetic&limit=200")).status).toBe(200);
    expect(load.searchPublic).toHaveBeenCalledTimes(2);
  });
  it("retains ownership until every read settles after partial failure, then permits retry", async () => {
    let release!: (value: unknown[]) => void;
    load.searchPublic.mockRejectedValue(new Error("synthetic-sensitive-canary@example.invalid"));
    load.getPublicSearchRelated.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const a = get("search", "q=synthetic");
    await vi.waitFor(() => expect(load.searchPublic).toHaveBeenCalledOnce());
    const b = get("search", "q=synthetic"); await Promise.resolve();
    expect(load.searchPublic).toHaveBeenCalledOnce();
    release([]); const responses = await Promise.all([a, b]);
    for (const response of responses) {
      expect(response.status).toBe(503); expect(response.headers.get("cache-control")).toContain("no-store");
      expect(await response.text()).not.toContain("synthetic-sensitive-canary");
    }
    load.searchPublic.mockResolvedValue({ query: "synthetic", hits: [] }); load.getPublicSearchRelated.mockResolvedValue([]);
    expect((await get("search", "q=synthetic")).status).toBe(200); expect(load.searchPublic).toHaveBeenCalledTimes(2);
  });
  it("caps distinct active keys at128 without retaining completed queries", async () => {
    const release: ((value: unknown) => void)[] = [];
    load.searchPublic.mockImplementation(() => new Promise(resolve => { release.push(resolve); }));
    const requests = Array.from({ length: 128 }, (_, index) => get("search", `q=synthetic-${index}`));
    await vi.waitFor(() => expect(load.searchPublic).toHaveBeenCalledTimes(128));
    const excess = await get("search", "q=synthetic-overflow");
    expect(excess.status).toBe(503); expect(excess.headers.get("cache-control")).toContain("no-store");
    expect(load.searchPublic).toHaveBeenCalledTimes(128);
    release.forEach(resolve => resolve({ query: "synthetic", hits: [] })); await Promise.all(requests);
    load.searchPublic.mockResolvedValue({ query: "synthetic-overflow", hits: [] });
    expect((await get("search", "q=synthetic-overflow")).status).toBe(200);
    expect(load.searchPublic).toHaveBeenCalledTimes(129);
  });
});
