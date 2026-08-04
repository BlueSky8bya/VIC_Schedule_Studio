import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { DIAG_RETENTION_DAYS, isDiagKind, isClientKind } from "@/lib/activity/kinds";

// 2026-08-04 실측 버그: 캐시된 떡밥 stub의 공개시각이 지난 뒤 관리자가 공개시각을 **미래로 다시**
// 잡으면, 클라는 "지났으니 내용 달라" → 서버는 "아직 미공개" → 빈 배열 → 카드가 빈 채로 멈췄다.
// 새로고침해도 캐시가 같은 옛 stub을 주므로 반복됐다.
const LOADER = fs.readFileSync(path.join(process.cwd(), "lib/schedules/public-loader.ts"), "utf8");

describe("loadRevealedEvents — 클라가 스스로 고칠 수 있어야 한다", () => {
  it("공개된 것만 걸러 내보내지 않는다(미공개도 최신 stub으로 돌려준다)", () => {
    const fn = LOADER.slice(
      LOADER.indexOf("export async function loadRevealedEvents"),
      LOADER.indexOf("const loadPublicScheduleData")
    );
    // 이 필터가 다시 생기면 빈 카드로 멈추는 버그가 재발한다.
    expect(fn).not.toMatch(/\.filter\(\s*\(e\)\s*=>\s*!e\.teaser\s*\)/);
    expect(fn).toContain("mapEvent(row, now)");
  });
  it("가림 stub에는 제목이 없다 — 미공개를 돌려줘도 내용 유출은 0", () => {
    const map = LOADER.slice(LOADER.indexOf("const revealMs"), LOADER.indexOf("return {\n    id: row.id,\n    startsAt: toKstIso(row.date_key, row.start_time)"));
    expect(map).toContain('publicTitle: ""');
    expect(map).toContain("tagIds: []");
  });
});

describe("진단 층 — 촘촘하되 짧게", () => {
  it("보존 3일", () => {
    expect(DIAG_RETENTION_DAYS).toBe(3);
  });
  it("diag.* 는 진단으로 판정되고 클라가 보낼 수 있다", () => {
    for (const k of ["diag.teaser", "diag.reveal", "diag.visible", "diag.refresh"]) {
      expect(isDiagKind(k)).toBe(true);
      expect(isClientKind(k)).toBe(true);
    }
  });
  it("일반 kind는 진단이 아니다", () => {
    expect(isDiagKind("ui.click")).toBe(false);
    expect(isDiagKind("event.update")).toBe(false);
  });
});

describe("프레즌스 키는 탭 단위", () => {
  it("localStorage면 두 탭이 서로를 덮어써 보고 있는 탭이 '탭만 열림'으로 잡힌다", () => {
    const SRC = fs.readFileSync(path.join(process.cwd(), "lib/presence/presence-client.ts"), "utf8");
    const block = SRC.slice(SRC.indexOf("let presenceKey"), SRC.indexOf("channel = client.channel"));
    expect(block).toContain("sessionStorage");
    expect(block).not.toContain("localStorage");
  });
});

describe("떡밥은 마운트마다 캐시 우회로 진실을 다시 받는다", () => {
  it("미리보기 스냅샷은 페이지 로드 시점 값이라 저장 후 껐다 켜면 되살아난다", () => {
    const SRC = fs.readFileSync(path.join(process.cwd(), "components/poster/public-poster.tsx"), "utf8");
    const block = SRC.slice(SRC.indexOf("const teaserIdsKey"), SRC.indexOf("const [agendaDetail"));
    // 마운트 동기화가 사라지면 '저장했는데 미리보기가 옛 공개시각'이 재발한다.
    expect(block).toContain("revealTeaserAction(ids)");
    expect(block).toContain("mount-sync");
  });
});
