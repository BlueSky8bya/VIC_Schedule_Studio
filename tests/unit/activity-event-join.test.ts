import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// activity_event.target에는 일정 uuid와 버튼 id('calendar-cell' 등)가 섞여 있다.
// 그대로 .in("id", ...)에 넘기면 uuid 컬럼 비교에서 형 변환 오류가 나 조인 전체가 실패하고,
// 살아 있는 일정까지 전부 제목 없이 '(지워진 일정)'으로 보인다(실측).
const SRC = fs.readFileSync(path.join(process.cwd(), "lib/activity/query.ts"), "utf8");

describe("일정 조인 — uuid만 넘긴다", () => {
  it("target을 uuid 형태로 거른 뒤 .in()에 넘긴다", () => {
    const block = SRC.slice(SRC.indexOf("const eventIds"), SRC.indexOf("titleById.set"));
    expect(block).toMatch(/UUID_RE\.test/);
  });
});

describe("공개 전 떡밥 제목은 가린다", () => {
  it("이 창은 편집실에서 열리고 편집실은 방송에 비칠 수 있다", () => {
    const block = SRC.slice(SRC.indexOf("const titleById"), SRC.indexOf("// 알려진 계정만"));
    expect(block).toContain("teaser_reveal_at");
    expect(block).toContain("공개 전 최초공개 일정");
  });
  it("비공개 범위는 제목 대신 범위 라벨만", () => {
    expect(SRC).toContain("SCOPE_LABEL");
    expect(SRC).toContain("(비공개 일정)");
  });
});
