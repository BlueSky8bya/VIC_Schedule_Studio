import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: null as User | null,
  developer: false,
  membershipError: false,
  adminUnavailable: false,
  serverUnavailable: false,
  authUser: vi.fn(),
  signOut: vi.fn(),
  admin: vi.fn()
}));
vi.mock("@/lib/auth/server", () => ({
  getCurrentSupabaseUser: state.authUser,
  createSupabaseServerClient: async () => state.serverUnavailable ? null : ({ auth: { signOut: state.signOut } })
}));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: state.admin }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "user-agent": "Synthetic boundary test" })
}));

import { resolveCurrentActor } from "@/lib/auth/actor";
import { getActivityDayAction, getActivityUsageAction } from "@/lib/activity/query";
import { recordActivityBatch } from "@/lib/activity/record";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as presence } from "@/app/api/developer/presence/route";

// Real actor/route/reader/writer functions, synthetic Auth/DB only. These tests
// establish no genuine OAuth, cookie invalidation or production RLS evidence.
const OWNER = "synthetic-owner@example.invalid";
const DEVELOPER = "synthetic-developer@example.invalid";
const PRIVATE = "SYNTHETIC_AUTH_IDENTITY_CANARY";
const DAY = "2026-06-11";
const denied = { ok: false, error: "개발자만 볼 수 있는 화면입니다." };

function user(email: string, provider = "google"): User {
  return {
    id: "00000000-0000-4000-8000-000000000001", email,
    aud: "authenticated", created_at: "2026-06-10T15:00:00Z",
    app_metadata: { provider }, user_metadata: { name: PRIVATE, role: "developer" }
  };
}

function database() {
  const reads: string[] = [];
  const writes: { table: string; rows: Record<string, unknown>[] }[] = [];
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn((table: string) => {
    const chain: Record<string, unknown> = {};
    chain.select = () => { reads.push(table); return chain; };
    for (const method of ["eq", "in", "gte", "lte", "not", "order"]) chain[method] = () => chain;
    chain.maybeSingle = async () => ({
      data: table === "platform_admins" && state.developer ? { email: DEVELOPER } : null,
      error: state.membershipError ? { message: PRIVATE } : null
    });
    chain.range = async () => ({ data: [], error: null });
    chain.insert = async (rows: Record<string, unknown>[]) => {
      writes.push({ table, rows }); return { data: null, error: null };
    };
    return chain;
  });
  return { from, rpc, reads, writes };
}
let db: ReturnType<typeof database>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("OWNER_EMAIL", OWNER);
  vi.stubEnv("VISUAL_TEST_FIXTURE", "1");
  vi.stubEnv("VISIT_HASH_SALT", "synthetic-session-boundary-only");
  vi.stubEnv("PRIVACY_RETENTION_CLEANUP_ENABLED", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No network in synthetic boundary tests"); }));
  state.user = null;
  state.developer = false;
  state.membershipError = false;
  state.adminUnavailable = false;
  state.serverUnavailable = false;
  state.authUser.mockImplementation(async () => state.user);
  state.signOut.mockImplementation(async () => { state.user = null; return { error: null }; });
  db = database();
  state.admin.mockImplementation(() => state.adminUnavailable ? null : db);
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("server authority with synthetic Auth", () => {
  it.each([
    { email: OWNER, developer: false, role: "owner" },
    { email: DEVELOPER, developer: true, role: "developer" },
    { email: "synthetic-viewer@example.invalid", developer: false, role: "viewer" }
  ])("resolves $role from trusted server sources, not user metadata", async ({ email, developer, role }) => {
    state.user = user(email); state.developer = developer;
    expect(await resolveCurrentActor("vic")).toMatchObject({ isAuthenticated: true, email, role });
    if (role === "owner") expect(state.admin).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not promote a non-Google account even when its email is an owner", async () => {
    state.user = user(OWNER, "email"); state.developer = true;
    expect(await resolveCurrentActor("vic")).toEqual({ email: OWNER, isAuthenticated: true, role: "viewer" });
    expect(state.admin).not.toHaveBeenCalled();
  });

  it.each(["membership-error", "missing-admin"])("fails closed on %s without claiming a confirmed viewer role", async condition => {
    state.user = user(DEVELOPER);
    state.membershipError = condition === "membership-error";
    state.adminUnavailable = condition === "missing-admin";
    expect(await resolveCurrentActor("vic")).toEqual({
      email: DEVELOPER, isAuthenticated: true, role: "viewer", roleUncertain: true
    });
    expect(await getActivityDayAction(DAY)).toEqual(denied);
    expect(await getActivityUsageAction(7, DAY)).toEqual(denied);
    expect(db.reads.every(table => table === "platform_admins")).toBe(true);
    expect(db.writes).toEqual([]); expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe("developer-only operational readers", () => {
  it.each(["anonymous", "viewer", "owner"])("rejects %s even with the production fixture flag set", async role => {
    state.user = role === "anonymous" ? null : user(role === "owner" ? OWNER : "synthetic-viewer@example.invalid");
    expect(await getActivityDayAction(DAY, true)).toEqual(denied);
    expect(await getActivityUsageAction(7, DAY)).toEqual(denied);
    const response = await presence();
    expect(response.status).toBe(role === "anonymous" ? 401 : 403);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(await response.text()).not.toContain(PRIVATE);
    expect(db.reads.every(table => table === "platform_admins")).toBe(true);
    expect(db.writes).toEqual([]); expect(db.rpc).not.toHaveBeenCalled();
  });

  it("retains valid developer access to both real reader functions", async () => {
    state.user = user(DEVELOPER); state.developer = true;
    expect(await getActivityDayAction(DAY)).toEqual({ ok: true, visits: [], total: 0 });
    expect(await getActivityUsageAction(7, DAY)).toMatchObject({ ok: true, rows: [], since: "2026-06-05", until: DAY });
    expect(db.reads).toEqual(expect.arrayContaining(["activity_event", "visit_session", "activity_daily_count"]));
    expect(db.writes).toEqual([]); expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe("logout and subsequent request separation", () => {
  it.each(["returned-error", "thrown-error", "missing-client"])("reports %s without a success redirect or sensitive error", async failure => {
    state.user = user(DEVELOPER); state.developer = true;
    if (failure === "returned-error") state.signOut.mockResolvedValue({ error: new Error(PRIVATE) });
    if (failure === "thrown-error") state.signOut.mockRejectedValue(new Error(PRIVATE));
    if (failure === "missing-client") state.serverUnavailable = true;
    const response = await logout(new Request("https://synthetic.invalid/api/auth/logout", { method: "POST" }));
    expect(response.status).toBe(503);
    expect(response.headers.has("location")).toBe(false);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    const body = await response.text();
    expect(body).not.toContain(PRIVATE);
    expect(body).not.toContain(DEVELOPER);
    expect(JSON.parse(body)).toEqual({ error: "logout_unavailable" });
    // A failed sign-out does not pretend to revoke or change the old authority.
    expect((await resolveCurrentActor("vic")).role).toBe("developer");
    expect(db.writes).toEqual([]); expect(db.rpc).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses local sign-out and resolves later stale client actions as anonymous counts", async () => {
    state.user = user(DEVELOPER); state.developer = true;
    expect((await resolveCurrentActor("vic")).role).toBe("developer");
    const response = await logout(new Request("https://synthetic.invalid/api/auth/logout", { method: "POST" }));
    expect(state.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://synthetic.invalid/");
    expect(await resolveCurrentActor("vic")).toEqual({ email: null, isAuthenticated: false, role: "viewer" });
    expect(await getActivityDayAction(DAY)).toEqual(denied);
    expect(await recordActivityBatch([{
      kind: "ui.click", target: "companion-pet", visitKey: "00000000-0000-4000-8000-000000000003",
      meta: { role: "developer", account_hash: PRIVATE, email: DEVELOPER }
    }], { device: "desktop" })).toBe(1);
    expect(db.writes).toEqual([]);
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("bump_activity_counts", { p_rows: [
      { day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), role: "anon", kind: "ui.click", target: "companion-pet", n: 1 }
    ] });
    expect(JSON.stringify(db.rpc.mock.calls)).not.toContain(PRIVATE);
    expect(JSON.stringify(db.rpc.mock.calls)).not.toContain(DEVELOPER);
    expect(JSON.stringify(db.rpc.mock.calls)).not.toContain("visit_key");
    expect(fetch).not.toHaveBeenCalled();
  });
});
