import { beforeEach, expect, it, vi } from "vitest";
const load = vi.hoisted(() => vi.fn());
vi.mock("@/lib/schedules/public-loader", () => ({ loadPublicTeaserState: load }));
const { GET } = await import("@/app/api/public/[calendarSlug]/teaser-state/route");
const { GET: confirm } = await import("@/app/api/public/[calendarSlug]/teaser-state/[eventId]/route");
const now = Date.now();
beforeEach(() => { load.mockReset(); });
it("caches anonymous discovery for 15 seconds without setting identity cookies", async () => {
  load.mockResolvedValue({ ok: true, schemaVersion: 1, sampledAtDbMs: now, entries: [] });
  const response = await GET(new Request("https://fixture/api/public/vic/teaser-state"), { params: Promise.resolve({ calendarSlug: "vic" }) });
  expect(response.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=15");
  expect(response.headers.has("set-cookie")).toBe(false);
});
it("uses a one-second shared response around the release, with no stale-while-revalidate", async () => {
  load.mockResolvedValue({ ok: true, schemaVersion: 1, sampledAtDbMs: now, entries: [{ revealAt: new Date(now + 10_000).toISOString() }] });
  const response = await GET(new Request("https://fixture/api/public/vic/teaser-state"), { params: Promise.resolve({ calendarSlug: "vic" }) });
  expect(response.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=1");
});
it("query strings and unsupported calendars are rejected without a DB read", async () => {
  const response = await GET(new Request("https://fixture/api/public/vic/teaser-state?ids=arbitrary"), { params: Promise.resolve({ calendarSlug: "vic" }) });
  expect(response.status).toBe(400);
  expect((await GET(new Request("https://fixture/api/public/other/teaser-state"), { params: Promise.resolve({ calendarSlug: "other" }) })).status).toBe(404);
  expect(load).not.toHaveBeenCalled();
});
it("an unavailable read is 503 unknown, never successful deletion", async () => {
  load.mockResolvedValue({ ok: false, schemaVersion: 1, sampledAtDbMs: 0, entries: [] });
  const response = await GET(new Request("https://fixture/api/public/vic/teaser-state"), { params: Promise.resolve({ calendarSlug: "vic" }) });
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect((await response.json()).ok).toBe(false);
});
it("confirms only canonical UUID keys through the same public loader", async () => {
  const id = "00000000-0000-4000-8000-000000000001";
  load.mockResolvedValue({ ok: true, schemaVersion: 1, sampledAtDbMs: now, entries: [] });
  expect((await confirm(new Request("https://fixture/api/public/vic/teaser-state/id"), { params: Promise.resolve({ calendarSlug: "vic", eventId: id }) })).status).toBe(200);
  expect(load).toHaveBeenCalledWith("vic", id);
  load.mockClear();
  expect((await confirm(new Request("https://fixture/api/public/vic/teaser-state/id"), { params: Promise.resolve({ calendarSlug: "vic", eventId: "arbitrary-combination" }) })).status).toBe(404);
  expect(load).not.toHaveBeenCalled();
});
