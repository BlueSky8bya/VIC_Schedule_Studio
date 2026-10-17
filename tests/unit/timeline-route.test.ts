import { beforeEach, expect, it, vi } from "vitest";
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/schedules/public-loader", () => ({ getPublicVodTimeline: load }));
import { GET } from "@/app/api/public/[calendarSlug]/vod-timeline/route";
beforeEach(() => { load.mockReset(); });
it("does not cache late additions or moderated alternatives for an hour", async () => {
  load.mockResolvedValue({ authorNick: "Fan", entries: [{ sec: 1, label: "A", section: null }], variants: [] });
  const response = await GET(new Request("https://fixture/api/public/vic/vod-timeline?titleNo=42"), { params: Promise.resolve({ calendarSlug: "vic" }) });
  expect(response.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=60");
  expect((await response.json()).authorNick).toBe("Fan");
});
it("never caches a failed source read as an empty timeline", async () => {
  load.mockRejectedValue(new Error("synthetic-sensitive-canary@example.invalid"));
  const response = await GET(new Request("https://fixture/api/public/vic/vod-timeline?titleNo=42"), { params: Promise.resolve({ calendarSlug: "vic" }) });
  expect(response.status).toBe(503);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.text()).not.toContain("synthetic-sensitive-canary");
});
it("keeps actual absence distinct from failure", async () => {
  load.mockResolvedValue(null);
  const response = await GET(new Request("https://fixture/api/public/vic/vod-timeline?titleNo=42"), { params: Promise.resolve({ calendarSlug: "vic" }) });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ authorNick: "", entries: [] });
  expect(response.headers.get("cache-control")).toContain("s-maxage=60");
});
