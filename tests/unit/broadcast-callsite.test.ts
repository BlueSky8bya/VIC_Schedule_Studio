import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

// G2 WARN 대응: 판서 DTO 변환(toBroadcastPanelDays)의 '호출 인자'를 소스에서 정적으로 고정한다.
// DTO 파일 자체의 import 경계 테스트(broadcast-dto.test.ts)는 호출자가 낙관적 previewSchedule/
// studio events를 넘기는 실수를 못 잡는다 — 여기서 호출부가 서버 공개 스냅샷
// (schedule.viewerModePreview)만 넘기는지 못박는다.
describe("broadcast panel — 호출부 정적 경계", () => {
  const shellSource = readFileSync(
    join(repoRoot, "components/studio/studio-shell.tsx"),
    "utf8"
  );

  it("toBroadcastPanelDays 호출은 항상 schedule.viewerModePreview를 첫 인자로 받는다", () => {
    const calls = shellSource.match(/toBroadcastPanelDays\s*\(([^;]*?)\)/gs) ?? [];
    expect(calls.length).toBeGreaterThan(0); // 호출부가 사라지면 이 테스트도 갱신할 것
    for (const call of calls) {
      expect(call).toMatch(/toBroadcastPanelDays\s*\(\s*schedule\.viewerModePreview\s*,/);
    }
  });

  it("호출부가 낙관적 미리보기(previewSchedule)나 studio events를 DTO로 넘기지 않는다", () => {
    expect(shellSource).not.toMatch(/toBroadcastPanelDays\s*\(\s*previewSchedule/);
    expect(shellSource).not.toMatch(/toBroadcastPanelDays\s*\(\s*\{?\s*events/);
  });

  it("판서 컴포넌트는 Studio 타입·studio-loader·낙관 경로를 import하지 않는다", () => {
    const panelSource = readFileSync(
      join(repoRoot, "components/studio/broadcast-panel.tsx"),
      "utf8"
    );
    const imports = panelSource
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line) || /\bfrom\s+["']/.test(line))
      .join("\n");
    for (const forbidden of [
      "@/lib/schedules/studio-loader",
      "@/lib/schedules/sample-data",
      "@/lib/auth/admin",
      "StudioSchedule", // 타입 포함 금지 — 공개 DTO(BroadcastPanel*)만 받는다
      "@/components/studio/studio-shell"
    ]) {
      expect(imports, `broadcast-panel must not import ${forbidden}`).not.toContain(forbidden);
    }
  });
});
