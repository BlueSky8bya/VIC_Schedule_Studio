import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ live: vi.fn(), tick: vi.fn(), timelines: vi.fn(), archive: vi.fn(), targets: vi.fn(), chat: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/broadcast/soop", () => ({ fetchSoopLive: mocks.live }));
vi.mock("@/lib/broadcast/session", () => ({ recordLiveTick: mocks.tick }));
vi.mock("@/lib/broadcast/vod-timeline", () => ({ maybeSyncTimelines: mocks.timelines, maybeSyncVodPipeline: mocks.archive }));
vi.mock("@/lib/broadcast/vod-chat", () => ({ pickChatSyncTargets: mocks.targets, syncVodChat: mocks.chat }));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

it.each(["broadcast-poll", "vod-chat"])("%s refuses missing secrets and invalid auth before any work", async (route) => {
  const { GET } = route === "broadcast-poll"
    ? await import("@/app/api/cron/broadcast-poll/route")
    : await import("@/app/api/cron/vod-chat/route");
  for (const secret of ["", "   "]) {
    vi.stubEnv("CRON_SECRET", secret);
    expect((await GET(new Request("https://fixture/api/cron/" + route))).status).toBe(503);
  }
  vi.stubEnv("CRON_SECRET", "fixture-secret");
  for (const authorization of ["", "Bearer wrong"]) {
    expect((await GET(new Request("https://fixture/api/cron/" + route, { headers: { authorization } }))).status).toBe(401);
  }
  for (const fn of Object.values(mocks)) expect(fn).not.toHaveBeenCalled();
});

it("authorized chat cron still processes targets", async () => {
  vi.stubEnv("CRON_SECRET", "fixture-secret");
  mocks.targets.mockResolvedValue([42]);
  mocks.chat.mockResolvedValue({ chunks: 0 });
  const { GET } = await import("@/app/api/cron/vod-chat/route");
  const response = await GET(new Request("https://fixture/api/cron/vod-chat", { headers: { authorization: "Bearer fixture-secret" } }));
  expect(response.status).toBe(200);
  expect(mocks.chat).toHaveBeenCalledWith([42], 60);
});
