import { expect, it, vi } from "vitest";
const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/schedules/public-loader", () => ({ getPublicVodChatProfile: load }));
import { GET } from "@/app/api/public/[calendarSlug]/vod-chat/route";
it("never caches empty analysis and expires populated profiles quickly", async () => {
  const request = new Request("https://fixture/api/public/vic/vod-chat?titleNo=42");
  const args = { params: Promise.resolve({ calendarSlug: "vic" }) };
  load.mockResolvedValue(null);
  expect((await GET(request, args)).headers.get("cache-control")).toBe("no-store");
  load.mockResolvedValue({ binSec: 30, laughTier: null, bins: [{ i: 0, h: 1, d: 1, l: 0, t: [] }] });
  const response = await GET(request, args);
  expect(response.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=30");
  expect(await response.json()).toEqual(await load());
});
