import { beforeEach, describe, expect, it, vi } from "vitest";

const actor = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/actor", () => ({ resolveCurrentActor: actor }));
import { getPrivacyHistoryAction } from "@/lib/legal/privacy-history";

beforeEach(() => { actor.mockReset(); });
describe("actual-authority policy history boundary", () => {
  it.each([
    { isAuthenticated: false, role: "viewer" },
    { isAuthenticated: true, role: "viewer" },
    { isAuthenticated: true, role: "owner" },
    { isAuthenticated: true, role: "developer", roleUncertain: true },
  ])("does not return operational history to %j", async value => {
    actor.mockResolvedValue(value);
    expect(await getPrivacyHistoryAction()).toEqual({ ok: false });
  });
  it("returns history only to the authenticated actual developer", async () => {
    actor.mockResolvedValue({ isAuthenticated: true, role: "developer" });
    const result = await getPrivacyHistoryAction();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.rows.some(row => row.effective === "2026. 11. 23.")).toBe(true);
    expect(actor).toHaveBeenCalledWith("vic");
  });
});
