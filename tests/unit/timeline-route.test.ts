import { expect, it, vi } from "vitest";
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/schedules/public-loader", () => ({ getPublicVodTimeline: load }));
import { GET } from "@/app/api/public/[calendarSlug]/vod-timeline/route";
it("does not cache late additions or moderated alternatives for an hour", async () => {
  load.mockResolvedValue({ authorNick: "Fan", entries: [{ sec: 1, label: "A", section: null }], variants: [] });
  const response = await GET(new Request("https://fixture/api/public/vic/vod-timeline?titleNo=42"), { params: Promise.resolve({ calendarSlug: "vic" }) });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect((await response.json()).authorNick).toBe("Fan");
});
