import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// 이용 기록 창의 새로고침은 **세 카드 전부**를 다시 받아야 한다.
// 예전엔 방문 통계만 다시 받고 행동 타임라인·사용량은 그대로여서, 창을 열어둔 채 시간이 지나면
// 그 뒤에 생긴 방문(관리자 접속 등)이 영영 안 보였다(실측: 15:29에 연 창에 15:40 관리자 방문 없음).
const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const MODAL = read("components/developer/day-visit-modal.tsx");
const TIMELINE = read("components/developer/activity-timeline.tsx");
const USAGE = read("components/developer/activity-usage.tsx");

describe("새로고침이 자식 카드까지 닿는다", () => {
  it("모달이 새로고침 때 reloadKey를 올린다", () => {
    expect(MODAL).toMatch(/setReloadKey\(\(k\) => k \+ 1\)/);
  });
  it("두 카드에 reloadKey를 내려준다", () => {
    expect(MODAL).toContain("<ActivityTimeline dateKey={dateKey} reloadKey={reloadKey} />");
    expect(MODAL).toContain("<ActivityUsage anchor={dateKey} reloadKey={reloadKey} />");
  });
  it("두 카드의 조회 effect가 reloadKey에 반응한다", () => {
    expect(TIMELINE).toMatch(/\}, \[dateKey, diag, reloadKey\]\);/);
    expect(USAGE).toMatch(/\}, \[days, anchor, reloadKey\]\);/);
  });
  it("타임라인이 '언제 받은 값인지'를 표시한다 — 굳었는지 눈으로 알 수 있어야 한다", () => {
    expect(TIMELINE).toContain("기준");
    expect(TIMELINE).toMatch(/setLoadedAt/);
  });
});
