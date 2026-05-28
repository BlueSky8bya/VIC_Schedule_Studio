import { describe, expect, it } from "vitest";
import {
  canEditSchedule,
  canReadOwnerPrivate,
  canReadPrivateLayer
} from "@/lib/permissions/roles";

describe("role permissions", () => {
  it("limits writes to owner and developer", () => {
    expect(canEditSchedule("owner")).toBe(true);
    expect(canEditSchedule("developer")).toBe(true);
    expect(canEditSchedule("manager")).toBe(false);
    expect(canEditSchedule("worker")).toBe(false);
    expect(canEditSchedule("viewer")).toBe(false);
  });

  it("private layer reads need unlock; owner/developer/worker only (manager excluded)", () => {
    // (role, isWorker, hasUnlockSession)
    expect(canReadPrivateLayer("developer", false, true)).toBe(true);
    expect(canReadPrivateLayer("owner", false, true)).toBe(true);
    expect(canReadPrivateLayer("worker", true, true)).toBe(true);
    // 매니저 단독은 잠금 해제해도 비공개를 못 본다.
    expect(canReadPrivateLayer("manager", false, true)).toBe(false);
    // 매니저+작업자 겸직(effective=manager, isWorker=true)은 작업자 자격으로 본다.
    expect(canReadPrivateLayer("manager", true, true)).toBe(true);
    // 잠금 세션이 없으면 자격이 있어도 못 본다.
    expect(canReadPrivateLayer("owner", false, false)).toBe(false);
    expect(canReadPrivateLayer("worker", true, false)).toBe(false);
    expect(canReadPrivateLayer("viewer", false, true)).toBe(false);
  });

  it("shows owner_private to the owner only (not even developer)", () => {
    expect(canReadOwnerPrivate("owner")).toBe(true);
    expect(canReadOwnerPrivate("developer")).toBe(false);
    expect(canReadOwnerPrivate("manager")).toBe(false);
    expect(canReadOwnerPrivate("worker")).toBe(false);
    expect(canReadOwnerPrivate("viewer")).toBe(false);
  });
});
