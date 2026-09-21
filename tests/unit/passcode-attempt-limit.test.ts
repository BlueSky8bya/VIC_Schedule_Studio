import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), verify: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/auth/actor", () => ({ resolveCurrentActor: async () => ({ role: "owner", isAuthenticated: true }) }));
vi.mock("@/lib/auth/server", () => ({ getCurrentSupabaseUser: async () => ({ id: "user" }), getCurrentAuthSessionId: async () => "session" }));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: () => ({ rpc: mocks.rpc, from: mocks.from }) }));
vi.mock("@/lib/private-layer/passcode", () => ({ verifyPasscode: mocks.verify, hashPasscode: vi.fn() }));
vi.mock("@/lib/activity/record", () => ({ recordActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { POST } from "@/app/api/unlock-private-layer/route";
import { setPasscodeAction } from "@/lib/private-layer/actions";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockImplementation((name: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: name === "calendars" ? { id: "calendar" } : { passcode_hash: "hash", passcode_version: 1, unlock_duration_minutes: 30 } }) }) }) }));
  mocks.verify.mockReturnValue(true);
});
it.each([
  [{ data: false, error: null }, 429],
  [{ data: null, error: { message: "secret-canary" } }, 503],
  [{ data: null, error: null }, 503]
])("both entrances deny before password checking when reservation fails", async (rpcResult, status) => {
  mocks.rpc.mockResolvedValue(rpcResult);
  const request = new Request("https://fixture/api/unlock-private-layer", { method: "POST", body: JSON.stringify({ passcode: "password", verifyOnly: true }) });
  const response = await POST(request);
  expect(response.status).toBe(status);
  expect(await response.text()).not.toContain("secret-canary");
  expect((await setPasscodeAction("next-password", "password")).ok).toBe(false);
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(mocks.rpc).toHaveBeenCalledWith("reserve_private_unlock_attempt", { p_user_id: "user" });
  expect(mocks.from.mock.calls.every(([name]) => ["calendars", "private_layer_settings"].includes(name))).toBe(true);
});
it("reserves even verification-only attempts before checking and does not issue a grant", async () => {
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  const response = await POST(new Request("https://fixture/api/unlock-private-layer", { method: "POST", body: JSON.stringify({ passcode: "password", verifyOnly: true }) }));
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toBeNull();
  expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(mocks.verify.mock.invocationCallOrder[0]);
  expect(mocks.from).not.toHaveBeenCalledWith("private_unlock_grants");
});
