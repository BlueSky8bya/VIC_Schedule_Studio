import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ actor: vi.fn(), admin: vi.fn(), verify: vi.fn(), hash: vi.fn(), activity: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/auth/actor", () => ({ resolveCurrentActor: mocks.actor }));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/lib/private-layer/passcode", () => ({ verifyPasscode: mocks.verify, hashPasscode: mocks.hash }));
vi.mock("@/lib/activity/record", () => ({ recordActivity: mocks.activity }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/auth/server", () => ({ getCurrentSupabaseUser: async () => ({ id: "user" }) }));
vi.mock("@/lib/private-layer/attempt-limit", () => ({ reservePasscodeAttempt: async () => "allowed" }));
import { setPasscodeAction } from "@/lib/private-layer/actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.actor.mockResolvedValue({ role: "owner", isAuthenticated: true });
  mocks.verify.mockReturnValue(true);
  mocks.hash.mockReturnValue("new-hash");
});

function database(settings: { data: unknown; error: unknown }, writeResult = { data: { calendar_id: "calendar" } as unknown, error: null as unknown }) {
  const filters: [string, unknown][] = [];
  const write = { eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return write; }), select: vi.fn(() => write), maybeSingle: vi.fn().mockResolvedValue(writeResult) };
  const update = vi.fn(() => write);
  const insert = vi.fn(() => write);
  const remove = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
  const read = (result: unknown) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => result }) }) });
  mocks.admin.mockReturnValue({ from: (name: string) => name === "calendars"
    ? read({ data: { id: "calendar" } })
    : name === "private_layer_settings" ? { ...read(settings), update, insert }
    : { delete: remove } });
  return { update, insert, remove, filters };
}

it("rejects settings read errors without checking or replacing a password", async () => {
  const db = database({ data: null, error: { message: "sensitive-detail" } });
  expect(await setPasscodeAction("next-pass", "old-pass")).toMatchObject({ ok: false });
  expect(mocks.verify).not.toHaveBeenCalled();
  expect(mocks.hash).not.toHaveBeenCalled();
  expect(db.update).not.toHaveBeenCalled();
  expect(db.insert).not.toHaveBeenCalled();
  expect(db.remove).not.toHaveBeenCalled();
});

it("updates only the version whose password was verified", async () => {
  const db = database({ data: { passcode_version: 7, passcode_hash: "old-hash" }, error: null });
  expect(await setPasscodeAction("next-pass", "old-pass")).toEqual({ ok: true });
  expect(mocks.verify).toHaveBeenCalledWith("old-pass", "old-hash");
  expect(db.filters).toEqual([["calendar_id", "calendar"], ["passcode_version", 7]]);
  expect(db.update).toHaveBeenCalledWith(expect.objectContaining({ passcode_version: 8 }));
  expect(db.insert).not.toHaveBeenCalled();
  expect(db.remove).toHaveBeenCalledTimes(1);
});

it.each([null, { message: "sensitive-detail" }])("rejects concurrent version changes or database failures without revoking grants", async (error) => {
  const db = database({ data: { passcode_version: 7, passcode_hash: "old-hash" }, error: null }, { data: null, error });
  const result = await setPasscodeAction("next-pass", "old-pass");
  expect(result.ok).toBe(false);
  expect(JSON.stringify(result)).not.toContain("sensitive-detail");
  expect(db.remove).not.toHaveBeenCalled();
});

it("first setup inserts and cannot overwrite a concurrent initializer", async () => {
  const db = database({ data: null, error: null }, { data: null, error: { code: "23505" } });
  expect((await setPasscodeAction("next-pass")).ok).toBe(false);
  expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({ passcode_version: 1 }));
  expect(db.update).not.toHaveBeenCalled();
  expect(db.remove).not.toHaveBeenCalled();
});

it("rejects viewer before reaching service role", async () => {
  mocks.actor.mockResolvedValue({ role: "viewer", isAuthenticated: true });
  expect((await setPasscodeAction("next-pass")).ok).toBe(false);
  expect(mocks.admin).not.toHaveBeenCalled();
});
