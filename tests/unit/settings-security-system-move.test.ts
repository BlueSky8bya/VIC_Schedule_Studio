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
    // 시청자 화면(포스터) 설정 창은 staffSettings로만 직원 탭을 받는다 — 공개 `/`는 넘기지 않고,
    // 편집실의 시청자 화면 미리보기는 **실제 역할**(actor.role)로 넘긴다(2026-11-13 소유자).
    const poster = read("components/poster/public-poster.tsx");
    expect(poster).toContain("security={staffSettings?.security ?? null}");
    expect(poster).toContain("devWorld={staffSettings?.devWorld ?? null}");
    expect(read("app/page.tsx")).not.toMatch(/staffSettings/);
    expect(shell).toContain("security: canUsePrivateLayer(actor.role) ? { onChangePasscode: openChangePasscode } : null");
    expect(shell).toContain('devWorld: actor.role === "developer" ?');
  });

  it("removes security and system panels from both insights surfaces", () => {
    const dev = read("components/developer/insights-dashboard.tsx");
    expect(dev).not.toMatch(/key: "security"|key: "system"|SecurityPanel|getPerfStatsAction/);
    const member = read("components/studio/member-insights.tsx");
    expect(member).not.toMatch(/canSecurity|SecurityPanel|getOwnerSecurityAction/);
  });
});
