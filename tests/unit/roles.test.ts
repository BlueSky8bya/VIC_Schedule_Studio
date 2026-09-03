import { describe, expect, it } from "vitest";
import {
  canEditEventTags,
  canEditSchedule,
  canEditSupport,
  canReadOwnerPrivate,
  canReadPrivateLayer
} from "@/lib/permissions/roles";

// 역할은 세 종류뿐: owner(관리자)·developer·viewer. (worker 철수 2026-08-27 ADR-0015, manager 철수
// 2026-09-04 ADR-0018 — 멤버 관리 기능이 프로젝트에서 빠졌다.)
describe("role permissions", () => {
  it("limits writes to owner and developer", () => {
    expect(canEditSchedule("owner")).toBe(true);
    expect(canEditSchedule("developer")).toBe(true);
    expect(canEditSchedule("viewer")).toBe(false);
  });

  it("support/tag assignment follow the same owner/developer line (no manager role any more)", () => {
    expect(canEditSupport("owner")).toBe(true);
    expect(canEditSupport("developer")).toBe(true);
    expect(canEditSupport("viewer")).toBe(false);
    expect(canEditEventTags("viewer")).toBe(false);
  });

  it("private layer reads need unlock; owner/developer only", () => {
    expect(canReadPrivateLayer("owner", true)).toBe(true);
    expect(canReadPrivateLayer("developer", true)).toBe(true);
    expect(canReadPrivateLayer("viewer", true)).toBe(false);
    expect(canReadPrivateLayer("owner", false)).toBe(false);
  });

  it("shows owner_private to the owner only (not even developer)", () => {
    expect(canReadOwnerPrivate("owner")).toBe(true);
    expect(canReadOwnerPrivate("developer")).toBe(false);
    expect(canReadOwnerPrivate("viewer")).toBe(false);
  });
});
