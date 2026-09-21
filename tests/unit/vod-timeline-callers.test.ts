import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ timeline: vi.fn(), archive: vi.fn(), after: vi.fn(), tick: vi.fn() }));
vi.mock("@/lib/broadcast/vod-timeline", () => ({ maybeSyncTimelines: mocks.timeline, maybeSyncVodPipeline: mocks.archive }));
vi.mock("@/lib/broadcast/session", () => ({ recordLiveTick: mocks.tick }));
vi.mock("@/lib/broadcast/soop", () => ({ fetchSoopLive: async () => ({ isLive: true, title: "fixture", bno: "1", startedAt: null }) }));
vi.mock("next/server", () => ({ NextResponse: { json: (data: unknown, init?: ResponseInit) => Response.json(data, init) }, after: mocks.after }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

it("cron checks existing timelines during a live broadcast without refreshing the archive", async () => {
  vi.stubEnv("CRON_SECRET", "fixture-secret");
  const { GET } = await import("@/app/api/cron/broadcast-poll/route");
  const denied = await GET(new Request("https://fixture/api/cron/broadcast-poll"));
  expect(denied.status).toBe(401);
  expect(mocks.timeline).not.toHaveBeenCalled();
  const res = await GET(new Request("https://fixture/api/cron/broadcast-poll", { headers: { authorization: "Bearer fixture-secret" } }));
  expect(res.status).toBe(200);
  expect(mocks.timeline).toHaveBeenCalledTimes(1);
  expect(mocks.archive).not.toHaveBeenCalled();
});

it("viewer live polling also schedules timeline checks while live", async () => {
  mocks.timeline.mockResolvedValue(undefined);
  const { GET } = await import("@/app/api/soop-live/route");
  await GET();
  expect(mocks.after).toHaveBeenCalledTimes(1);
  await mocks.after.mock.calls[0][0]();
  expect(mocks.timeline).toHaveBeenCalledTimes(1);
  expect(mocks.archive).not.toHaveBeenCalled();
});
