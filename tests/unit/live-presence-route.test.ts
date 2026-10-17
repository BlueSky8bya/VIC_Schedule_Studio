import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ actor: vi.fn(), admin: vi.fn(), queries: [] as { column?: string; value?: string; filters: unknown[] }[] }));
vi.mock("@/lib/auth/actor", () => ({ resolveCurrentActor: mocks.actor }));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
import { GET } from "@/app/api/developer/presence/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.queries.length = 0;
  mocks.actor.mockResolvedValue({ isAuthenticated: true, role: "developer" });
});
afterEach(() => vi.useRealTimers());

it.each([
  [false, "viewer", false, 401], [false, "developer", false, 401],
  [true, "viewer", false, 403], [true, "owner", false, 403], [true, "developer", true, 403]
])("denies auth=%s role=%s uncertain=%s before loading operational data", async (isAuthenticated, role, roleUncertain, status) => {
  mocks.actor.mockResolvedValue({ isAuthenticated, role, roleUncertain });
  const response = await GET();
  expect(response.status).toBe(status);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(mocks.admin).not.toHaveBeenCalled();
});

function database(fail = false) {
  return { rpc: vi.fn((name: string, args: { p_observed_at: string }) => {
    expect(name).toBe("developer_live_presence_counts");
    mocks.queries.push({ filters: [["observedAt", args.p_observed_at]] });
    return { abortSignal: async (signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      return { error: fail ? { message: "private-canary@example.invalid" } : null,
        data: { total: 7, roles: { owner: 0, viewer: 0, anon: 7, developer: 0 },
          devices: { desktop: 7, android: 0, ios: 0, mobile: 0 },
          id: "session-canary", account_hash: "hash-canary", email: "private-canary@example.invalid" } };
    } };
  }) };
}

it("returns explicit counts with one snapshot RPC, retaining the canonical observation time", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-21T15:00:10Z")); // KST midnight + 10s
  mocks.admin.mockReturnValue(database());
  const response = await GET();
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data).toEqual({ observedAt: expect.any(String), windowSeconds: 90, total: 7,
    roles: { owner: 0, viewer: 0, anon: 7, developer: 0 },
    devices: { desktop: 7, android: 0, ios: 0, mobile: 0 } });
  expect(JSON.stringify(data)).not.toMatch(/canary|account_hash|session|email/);
  expect(mocks.queries).toEqual([{ filters: [["observedAt", data.observedAt]] }]);
  expect(response.headers.get("Cache-Control")).toContain("private, no-store");
});

it.each(["auth", "config", "database"])("fails closed on %s failure without leaking diagnostics", async (failure) => {
  if (failure === "auth") mocks.actor.mockRejectedValue(new Error("private-canary"));
  mocks.admin.mockReturnValue(failure === "config" ? null : database(true));
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ error: "unavailable" });
  expect(response.headers.get("Cache-Control")).toContain("no-store");
});

it.each([null, {}, { total: -1 }, { total: 1, roles: {}, devices: {} }])("fails closed on malformed aggregate %j", async (data) => {
  mocks.admin.mockReturnValue({ rpc: () => ({ abortSignal: async () => ({ data, error: null }) }) });
  expect((await GET()).status).toBe(503);
});
