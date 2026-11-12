import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canUsePrivateLayer } from "@/lib/permissions/roles";

// 2026-11-13: 인사이트 '보안'·'시스템' 탭을 설정 창으로 옮겼다. 보안 묶음은 관리자·개발자만,
// 시스템은 개발자 묶음 안에만 있고, 인사이트에는 둘 다 없다.
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("settings security/system move", () => {
  it("shows the security tab only for owner and developer", () => {
    expect(canUsePrivateLayer("owner")).toBe(true);
    expect(canUsePrivateLayer("developer")).toBe(true);
    expect(canUsePrivateLayer("viewer")).toBe(false);
  });

  it("gates the tab on the security prop and wires it from the effective studio role", () => {
    const settings = read("components/studio/studio-settings.tsx");
    expect(settings).toMatch(/\.\.\.\(security \? \[\{ key: "security" as const, label: "보안"/);
    expect(settings).toMatch(/current === "security" \? <SecurityPanel/);
    expect(settings).toMatch(/current === "dev" \? <SystemPanel \/>/);
    const shell = read("components/studio/studio-shell.tsx");
    expect(shell).toContain("security={canUsePrivateLayer(effectiveRole) ? { onChangePasscode: openChangePasscode } : null}");
    // 시청자 화면(공개 포스터)의 설정 창에는 보안 묶음이 없다.
    expect(read("components/poster/public-poster.tsx")).not.toMatch(/\bsecurity=\{/);
  });

  it("removes security and system panels from both insights surfaces", () => {
    const dev = read("components/developer/insights-dashboard.tsx");
    expect(dev).not.toMatch(/key: "security"|key: "system"|SecurityPanel|getPerfStatsAction/);
    const member = read("components/studio/member-insights.tsx");
    expect(member).not.toMatch(/canSecurity|SecurityPanel|getOwnerSecurityAction/);
  });
});
