import { describe, expect, it } from "vitest";
import {
  canEditEventTags,
  canEditSchedule,
  canEditSupport,
  canUsePrivateLayer
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

  it("editor passcode (teaser gate, passcode change) is owner/developer only", () => {
    expect(canUsePrivateLayer("owner")).toBe(true);
    expect(canUsePrivateLayer("developer")).toBe(true);
    expect(canUsePrivateLayer("viewer")).toBe(false);
  });
});
