import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ actor: vi.fn(), admin: vi.fn(), queries: [] as { column?: string; value?: string; filters: unknown[] }[] }));
vi.mock("@/lib/auth/actor", () => ({ resolveCurrentActor: mocks.actor }));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
import { GET } from "@/app/api/developer/presence/route";
import { kstDayKey } from "@/lib/calendar/month";

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
  return { from: vi.fn((table: string) => {
    expect(table).toBe("visit_session");
    const query: (typeof mocks.queries)[number] = { filters: [] };
    mocks.queries.push(query);
    const chain = {
      select: (column: string, options: unknown) => { expect(column).toBe("id"); expect(options).toEqual({ count: "exact", head: true }); return chain; },
      is: (...args: unknown[]) => { query.filters.push(["is", ...args]); return chain; },
      gte: (...args: unknown[]) => { query.filters.push(["gte", ...args]); return chain; },
      lte: (...args: unknown[]) => { query.filters.push(["lte", ...args]); return chain; },
      in: (...args: unknown[]) => { query.filters.push(["in", ...args]); return chain; },
      eq: (column: string, value: string) => {
        query.column = column; query.value = value;
        return Promise.resolve({ count: value === "anon" || value === "desktop" ? 7 : 0,
          error: fail ? { message: "private-canary@example.invalid" } : null,
          data: [{ id: "session-canary", account_hash: "hash-canary", email: "private-canary@example.invalid" }] });
      }
    };
    return chain;
  }) };
}

it("returns only explicit counts and limits the query to the window's KST days", async () => {
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
  expect(mocks.queries).toHaveLength(8);
  for (const query of mocks.queries) {
    expect(query.filters).toEqual([
      ["gte", "day", kstDayKey(new Date(Date.parse(data.observedAt) - 90_000))],
      ["is", "ended_at", null],
      ["gte", "last_seen_at", new Date(Date.parse(data.observedAt) - 90_000).toISOString()],
      ["lte", "last_seen_at", data.observedAt],
      ["in", "role", ["owner", "viewer", "anon", "developer"]]
    ]);
  }
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
