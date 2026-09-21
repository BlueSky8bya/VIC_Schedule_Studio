import { afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ actor: vi.fn(), admin: vi.fn(), rpc: vi.fn(), invalidate: vi.fn(), path: vi.fn() }));
vi.mock("@/lib/auth/actor", () => ({ resolveCurrentActor: mock.actor }));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: mock.admin }));
vi.mock("@/lib/schedules/cache", () => ({ revalidatePublicSchedule: mock.invalidate }));
vi.mock("next/cache", () => ({ revalidatePath: mock.path }));
import { moderateTimelineAction, getTimelineManagement } from "@/lib/broadcast/timeline-actions";
afterEach(() => vi.clearAllMocks());

it.each([{ role: "viewer", isAuthenticated: true }, { role: "viewer", isAuthenticated: false }, { role: "owner", isAuthenticated: false }])("denies unauthorized actor %j before using service credentials", async (actor) => {
  mock.actor.mockResolvedValue(actor);
  expect((await moderateTimelineAction({ titleNo: 42, key: "root:1", action: "pin" })).ok).toBe(false);
  expect((await getTimelineManagement()).ok).toBe(false);
  expect(mock.admin).not.toHaveBeenCalled();
});
it.each(["owner", "developer"])("allows %s to set a representative through the atomic RPC", async (role) => {
  mock.actor.mockResolvedValue({ role, isAuthenticated: true });
  mock.admin.mockReturnValue({ rpc: mock.rpc });
  mock.rpc.mockResolvedValue({ error: null });
  expect(await moderateTimelineAction({ titleNo: 42, key: "root:1", action: "pin" })).toEqual({ ok: true });
  expect(mock.rpc).toHaveBeenCalledWith("vod_timeline_moderate", { p_title_no: 42, p_key: "root:1", p_action: "pin" });
  expect(mock.invalidate).toHaveBeenCalledTimes(1);
});
it("rejects malformed actions and does not expose database errors", async () => {
  mock.actor.mockResolvedValue({ role: "owner", isAuthenticated: true });
  mock.admin.mockReturnValue({ rpc: mock.rpc });
  expect((await moderateTimelineAction({ titleNo: -1, action: "pin" })).ok).toBe(false);
  expect(mock.rpc).not.toHaveBeenCalled();
  mock.rpc.mockResolvedValue({ error: { message: "sensitive internal detail" } });
  expect(JSON.stringify(await moderateTimelineAction({ titleNo: 42, key: "root:1", action: "pin" }))).not.toContain("sensitive");
});
