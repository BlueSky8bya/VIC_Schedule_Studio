import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// PostgREST는 응답 행 수를 서버 설정(기본 1000)으로 자른다. limit을 크게 줘도 1000행만 온다.
// 오류도 안 나고 조용히 잘리므로, 하루 기록이 1000행을 넘는 순간 그 뒤 방문이 통째로 사라진다.
// 실측: 화면이 15:29에서 멈췄고 그 뒤 관리자 방문(15:40~)이 안 보였다. 실제 호출로 정확히
// 1000행·마지막 15:29를 확인했다. 이 프로젝트가 두 번째로 당한 함정이다(앞서 visit_session).
const SRC = fs.readFileSync(path.join(process.cwd(), "lib/activity/query.ts"), "utf8");
const CODE = SRC.split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");

describe("행 상한 — limit이 아니라 range로 끝까지 받는다", () => {
  it("페이지네이션 헬퍼가 있다", () => {
    expect(SRC).toContain("async function fetchAllRows");
    expect(CODE).toContain(".range(from, to)");
  });

  it("네 자리 이상 limit을 쓰지 않는다 — '다 온다'는 착각을 준다", () => {
    const bigLimits = CODE.match(/\.limit\(\d{4,}\)/g) ?? [];
    expect(bigLimits).toEqual([]);
  });

  it("하루 조회와 사용량 집계 둘 다 페이지네이션을 쓴다", () => {
    const dayPart = CODE.slice(
      CODE.indexOf("getActivityDayAction"),
      CODE.indexOf("getActivityUsageAction")
    );
    const usagePart = CODE.slice(CODE.indexOf("getActivityUsageAction"));
    expect(dayPart).toContain("fetchAllRows");
    expect(usagePart).toContain("fetchAllRows");
  });
});
