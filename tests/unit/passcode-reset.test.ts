import { beforeEach, expect, it, vi } from "vitest";

// 비밀번호를 잊었을 때의 다시 만들기(2026-11-23): 현재 비밀번호를 묻지 않는 대신
// '방금 구글로 다시 로그인'(10분)이 있어야 하고, 역할·시도 제한·버전 CAS는 변경과 같다.
const mocks = vi.hoisted(() => ({
  actor: vi.fn(), admin: vi.fn(), verify: vi.fn(), hash: vi.fn(), activity: vi.fn(), revalidate: vi.fn(),
  user: { id: "user", last_sign_in_at: null as string | null }, attempt: "allowed" as "allowed" | "limited" | "unavailable"
}));
vi.mock("@/lib/auth/actor", () => ({ resolveCurrentActor: mocks.actor }));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/lib/private-layer/passcode", () => ({ verifyPasscode: mocks.verify, hashPasscode: mocks.hash }));
vi.mock("@/lib/activity/record", () => ({ recordActivity: mocks.activity }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/auth/server", () => ({ getCurrentSupabaseUser: async () => mocks.user }));
vi.mock("@/lib/private-layer/attempt-limit", () => ({ reservePasscodeAttempt: async () => mocks.attempt }));
import { resetPasscodeAction } from "@/lib/private-layer/actions";
import { PASSCODE_RESET_LOGIN_HREF, signedInRecently } from "@/lib/private-layer/recent-login";
import { sanitizeNextPath } from "@/lib/auth/next-path";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function database(existing: { passcode_version: number; passcode_hash: string } | null) {
  const filters: [string, unknown][] = [];
  const write = { eq: vi.fn((k: string, v: unknown) => { filters.push([k, v]); return write; }), select: vi.fn(() => write), maybeSingle: vi.fn().mockResolvedValue({ data: { calendar_id: "calendar" }, error: null }) };
  const update = vi.fn(() => write);
  const insert = vi.fn(() => write);
  const read = (result: unknown) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) });
  mocks.admin.mockReturnValue({ from: (name: string) => name === "calendars" ? read({ data: { id: "calendar" } }) : { ...read({ data: existing, error: null }), update, insert } });
  return { update, insert, filters };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.actor.mockResolvedValue({ role: "owner", isAuthenticated: true });
  mocks.hash.mockReturnValue("new-hash");
  mocks.user = { id: "user", last_sign_in_at: minutesAgo(2) };
  mocks.attempt = "allowed";
});

it("replaces a forgotten passcode after a fresh Google sign-in, without asking for the old one", async () => {
  const db = database({ passcode_version: 7, passcode_hash: "old-hash" });
  expect(await resetPasscodeAction("next-pass")).toEqual({ ok: true });
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(db.filters).toEqual([["calendar_id", "calendar"], ["passcode_version", 7]]);
  expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ passcode_version: 8, passcode_hash: "new-hash" }));
});

it.each([["stale sign-in", minutesAgo(11)], ["no sign-in time", null], ["far-future time", new Date(Date.now() + 3600_000).toISOString()]])("refuses without a recent sign-in (%s) and asks to sign in again", async (_label, at) => {
  mocks.user = { id: "user", last_sign_in_at: at };
  const db = database({ passcode_version: 7, passcode_hash: "old-hash" });
  expect(await resetPasscodeAction("next-pass")).toMatchObject({ ok: false, needsLogin: true });
  expect(mocks.hash).not.toHaveBeenCalled();
  expect(db.update).not.toHaveBeenCalled();
  expect(db.insert).not.toHaveBeenCalled();
});

it("keeps the role gate and the attempt limit in front of the reset", async () => {
  const db = database({ passcode_version: 7, passcode_hash: "old-hash" });
  mocks.actor.mockResolvedValue({ role: "viewer", isAuthenticated: true });
  expect((await resetPasscodeAction("next-pass")).ok).toBe(false);
  expect(mocks.admin).not.toHaveBeenCalled();
  mocks.actor.mockResolvedValue({ role: "owner", isAuthenticated: true });
  mocks.attempt = "limited";
  expect(await resetPasscodeAction("next-pass")).toMatchObject({ ok: false });
  expect(db.update).not.toHaveBeenCalled();
});

it("rejects a too-short new passcode before touching the database", async () => {
  database({ passcode_version: 7, passcode_hash: "old-hash" });
  expect((await resetPasscodeAction("abc")).ok).toBe(false);
  expect(mocks.admin).not.toHaveBeenCalled();
});

it("window helper and the sign-in link", () => {
  const now = Date.parse("2027-01-01T00:00:00Z");
  expect(signedInRecently({ last_sign_in_at: "2026-12-31T23:51:00Z" }, now)).toBe(true);
  expect(signedInRecently({ last_sign_in_at: "2026-12-31T23:49:00Z" }, now)).toBe(false);
  expect(signedInRecently({ last_sign_in_at: "not-a-date" }, now)).toBe(false);
  expect(signedInRecently(null, now)).toBe(false);
  // 로그인 경로가 돌아올 주소를 그대로 통과시켜야 창이 다시 열린다.
  const next = new URL(PASSCODE_RESET_LOGIN_HREF, "https://example.invalid").searchParams.get("next")!;
  expect(sanitizeNextPath(next)).toBe("/studio?passcode=reset");
});
