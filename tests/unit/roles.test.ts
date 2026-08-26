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
    expect(canEditSchedule("viewer")).toBe(false);
  });

  it("private layer reads need unlock; owner/developer only (manager excluded, worker retired)", () => {
    expect(canReadPrivateLayer("owner", true)).toBe(true);
    expect(canReadPrivateLayer("developer", true)).toBe(true);
    expect(canReadPrivateLayer("manager", true)).toBe(false);
    expect(canReadPrivateLayer("viewer", true)).toBe(false);
    expect(canReadPrivateLayer("owner", false)).toBe(false);
  });

  it("shows owner_private to the owner only (not even developer)", () => {
    expect(canReadOwnerPrivate("owner")).toBe(true);
    expect(canReadOwnerPrivate("developer")).toBe(false);
    expect(canReadOwnerPrivate("manager")).toBe(false);
    expect(canReadOwnerPrivate("viewer")).toBe(false);
  });
});
