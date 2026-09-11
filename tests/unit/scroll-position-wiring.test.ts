import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// 스크롤바를 그리지 않는 목록(행동 타임라인 · 적게 쓰인 기능 · 세션 로그 두 곳)은 "지금 어디쯤"을
// 다른 수단으로 말해야 한다(2026-09-11 소유자). 표시기는 목록의 직계 자식과 data-pos를 읽으므로,
// 둘 중 하나만 빠져도 조용히 아무것도 안 나온다 — 그래서 배선을 못으로 박아 둔다.
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");

const LISTS: { file: string; list: string }[] = [
  { file: "components/developer/activity-timeline.tsx", list: "act-visits" },
  { file: "components/developer/activity-usage.tsx", list: "usage-list" },
  { file: "components/developer/day-visit-modal.tsx", list: "vlog" },
  { file: "components/developer/insights-dashboard.tsx", list: "vlog" }
];

describe("읽는 위치 표시기 배선", () => {
  for (const { file, list } of LISTS) {
    it(`${file}의 ${list} 목록이 표시기와 data-pos를 갖는다`, () => {
      const src = read(file);
      expect(src).toContain("<ScrollPosition");
      expect(src).toMatch(new RegExp(`className="${list}" ref=\\{`));
      expect(src).toContain("data-pos=");
    });
  }

  it("표시기는 넘치지 않는 목록에서는 아무것도 그리지 않는다", () => {
    const src = read("components/developer/scroll-position.tsx");
    expect(src).toMatch(/max <= 4/);
    expect(src).toContain("if (!pos) return null;");
  });
});
